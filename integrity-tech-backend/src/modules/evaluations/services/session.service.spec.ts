import { ForbiddenException } from '@nestjs/common';
import { SessionService } from './session.service';

describe('Evaluation SessionService consent gate', () => {
  const user = {
    userId: '00000000-0000-7000-8000-000000000003',
    organizationId: '00000000-0000-7000-8000-000000000002',
  };
  const attempt = {
    id: '00000000-0000-7000-8000-000000000501',
    examId: '00000000-0000-7000-8000-000000000301',
    organizationId: user.organizationId,
    userId: user.userId,
    status: 'IN_PROGRESS',
    startedAt: new Date('2026-07-02T00:00:00.000Z'),
    submittedAt: null,
  };

  let prisma: any;
  let attempts: any;
  let consentService: any;
  let auditService: any;
  let governanceResolver: any;
  let service: SessionService;

  beforeEach(() => {
    prisma = {
      examQuestion: {
        findMany: jest.fn().mockResolvedValue([
          {
            questionId: '00000000-0000-7000-8000-000000000201',
            points: 2,
          },
        ]),
      },
      question: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: '00000000-0000-7000-8000-000000000201',
            type: 'MULTIPLE_CHOICE',
            defaultPoints: 2,
            contentJsonb: {
              text: 'Pregunta',
              correctConfig: { optionId: 'a' },
            },
          },
        ]),
      },
    };
    attempts = {
      findAttemptInTenant: jest.fn().mockResolvedValue(attempt),
      findExamInTenant: jest.fn().mockResolvedValue({
        id: attempt.examId,
        title: 'Evaluación demo',
        durationMinutes: 30,
      }),
    };
    consentService = {
      hasConsent: jest.fn(),
    };
    auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    governanceResolver = {
      findGovernedSessionItems: jest.fn(),
    };
    service = new SessionService(prisma, attempts, consentService, auditService, governanceResolver);
  });

  it('rejects session loading when candidate consent is missing', async () => {
    consentService.hasConsent.mockResolvedValue(false);

    await expect(service.getAttemptSession(attempt.id, user)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('loads real questions without correct answers after consent', async () => {
    consentService.hasConsent.mockResolvedValue(true);

    const result = await service.getAttemptSession(attempt.id, user);

    expect(result.questions).toHaveLength(1);
    expect((result.questions[0] as any).content.correctConfig).toBeUndefined();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'exam.session.accessed',
        organizationId: user.organizationId,
        actorUserId: user.userId,
      }),
    );
  });

  it('loads questions from AssessmentVersionItem when attempt is governed', async () => {
    consentService.hasConsent.mockResolvedValue(true);
    attempts.findAttemptInTenant.mockResolvedValue({
      ...attempt,
      assessmentVersionId: '00000000-0000-7000-8000-000000000901',
    });
    governanceResolver.findGovernedSessionItems.mockResolvedValue([
      {
        itemVersionId: '00000000-0000-7000-8000-000000000902',
        weight: 2,
        itemVersion: {
          stemJson: {
            legacyQuestionId: '00000000-0000-7000-8000-000000000201',
            type: 'MULTIPLE_CHOICE',
            defaultPoints: 2,
            content: {
              text: 'Pregunta gobernada',
              correctConfig: { optionId: 'a' },
            },
          },
        },
      },
    ]);

    const result = await service.getAttemptSession(attempt.id, user);

    expect(result.questions[0]).toEqual(
      expect.objectContaining({
        id: '00000000-0000-7000-8000-000000000201',
        itemVersionId: '00000000-0000-7000-8000-000000000902',
        type: 'MULTIPLE_CHOICE',
      }),
    );
    expect((result.questions[0] as any).content.correctConfig).toBeUndefined();
    expect(prisma.examQuestion.findMany).not.toHaveBeenCalled();
  });
});
