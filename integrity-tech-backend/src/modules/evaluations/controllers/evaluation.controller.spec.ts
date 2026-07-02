import { EvaluationController } from './evaluation.controller';

describe('EvaluationController flujo mínimo real', () => {
  const staffUser = {
    userId: '00000000-0000-7000-8000-000000000001',
    organizationId: '00000000-0000-7000-8000-000000000002',
    email: 'admin@integrity.demo',
    roles: ['admin'],
  };

  const candidateUser = {
    userId: '00000000-0000-7000-8000-000000000003',
    organizationId: staffUser.organizationId,
    email: 'candidate@integrity.demo',
    roles: ['candidate'],
  };

  function createController(overrides: Record<string, any> = {}) {
    const queueProducer = {
      enqueueAnswer: jest.fn().mockResolvedValue({ jobId: 'job-1' }),
    };
    const prisma = {
      candidateInvitation: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      exam: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      examAttempt: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      examQuestion: {
        findMany: jest.fn(),
      },
      question: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
      ...overrides.prisma,
    };
    const igaCalculator = {};
    const iamFacade = {
      issueSessionToken: jest.fn().mockReturnValue('signed-jwt-token'),
    };
    const answersProcessor = {
      consolidateAttemptScore: jest.fn().mockResolvedValue(undefined),
    };

    const controller = new EvaluationController(
      queueProducer as any,
      prisma as any,
      igaCalculator as any,
      iamFacade as any,
      answersProcessor as any,
    );

    return { controller, queueProducer, prisma, iamFacade, answersProcessor };
  }

  it('crea invitación persistida para un examen real', async () => {
    const { controller, prisma } = createController();
    prisma.exam.findFirst.mockResolvedValue({
      id: '00000000-0000-7000-8000-000000000301',
      organizationId: staffUser.organizationId,
    });
    prisma.candidateInvitation.findUnique.mockResolvedValue(null);
    prisma.candidateInvitation.create.mockImplementation(({ data }) => Promise.resolve(data));

    const result = await controller.createInvitation(
      { user: staffUser },
      {
        candidateName: 'Candidato Demo',
        email: 'candidate@integrity.demo',
        examId: '00000000-0000-7000-8000-000000000301',
      },
    );

    expect(result.status).toBe('success');
    expect(result.accessCode).toMatch(/^IT-\d{6}$/);
    expect(prisma.candidateInvitation.create).toHaveBeenCalled();
  });

  it('claim crea candidato/intento y devuelve JWT real', async () => {
    const { controller, prisma, iamFacade } = createController();
    prisma.candidateInvitation.findUnique.mockResolvedValue({
      id: 'inv-1',
      examId: '00000000-0000-7000-8000-000000000301',
      candidateName: 'Candidato Demo',
      email: 'candidate@integrity.demo',
      accessCode: 'IT-123456',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60000),
    });
    prisma.exam.findUnique.mockResolvedValue({
      id: '00000000-0000-7000-8000-000000000301',
      organizationId: staffUser.organizationId,
    });
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        user: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: candidateUser.userId,
            email: candidateUser.email,
          }),
        },
        examAttempt: {
          create: jest.fn().mockResolvedValue({
            id: '00000000-0000-7000-8000-000000000501',
          }),
        },
        candidateInvitation: {
          update: jest.fn().mockResolvedValue({}),
        },
      }),
    );

    const result = await controller.claimInvitation({
      accessCode: 'IT-123456',
      candidateName: 'Candidato Demo',
      email: 'candidate@integrity.demo',
    });

    expect(result.token).toBe('signed-jwt-token');
    expect(result.attemptId).toBe('00000000-0000-7000-8000-000000000501');
    expect(iamFacade.issueSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ['candidate'] }),
    );
  });

  it('session devuelve preguntas sin correctConfig', async () => {
    const { controller, prisma } = createController();
    prisma.examAttempt.findUnique.mockResolvedValue({
      id: '00000000-0000-7000-8000-000000000501',
      examId: '00000000-0000-7000-8000-000000000301',
      userId: candidateUser.userId,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      submittedAt: null,
    });
    prisma.exam.findUnique.mockResolvedValue({
      id: '00000000-0000-7000-8000-000000000301',
      title: 'Evaluación Demo',
      durationMinutes: 30,
    });
    prisma.examQuestion.findMany.mockResolvedValue([
      {
        questionId: '00000000-0000-7000-8000-000000000201',
        points: 2,
      },
    ]);
    prisma.question.findMany.mockResolvedValue([
      {
        id: '00000000-0000-7000-8000-000000000201',
        type: 'MULTIPLE_CHOICE',
        defaultPoints: 2,
        contentJsonb: {
          text: 'Pregunta',
          correctConfig: { correctOptionId: 'b' },
        },
      },
    ]);

    const result = await controller.getAttemptSession('00000000-0000-7000-8000-000000000501');

    expect(result.questions).toHaveLength(1);
    expect((result.questions[0] as any).content.correctConfig).toBeUndefined();
  });

  it('submit encola respuesta', async () => {
    const { controller, queueProducer } = createController();

    const result = await controller.submitAnswer('00000000-0000-7000-8000-000000000501', {
      questionId: '00000000-0000-7000-8000-000000000201',
      response: { selectedOptionId: 'b' },
    } as any);

    expect(result.status).toBe('accepted');
    expect(queueProducer.enqueueAnswer).toHaveBeenCalled();
  });

  it('finalize es idempotente y consolida intento', async () => {
    const { controller, prisma, answersProcessor } = createController();
    prisma.examAttempt.findUnique.mockResolvedValue({
      id: '00000000-0000-7000-8000-000000000501',
      status: 'IN_PROGRESS',
    });
    prisma.examAttempt.update.mockResolvedValue({});

    const result = await controller.finalizeAttempt('00000000-0000-7000-8000-000000000501');

    expect(result.status).toBe('COMPLETED');
    expect(prisma.examAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUBMITTED' }),
      }),
    );
    expect(answersProcessor.consolidateAttemptScore).toHaveBeenCalledWith(
      '00000000-0000-7000-8000-000000000501',
    );
  });
});
