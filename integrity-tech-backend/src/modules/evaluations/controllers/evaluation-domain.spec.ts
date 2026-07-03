import { BadRequestException } from '@nestjs/common';
import { InvitationsController } from './invitations.controller';
import { EvaluationSessionController } from './evaluation-session.controller';
import { ResponsesController } from './responses.controller';
import { EvaluationFinalizeController } from './evaluation-finalize.controller';
import { ReportsController } from './reports.controller';

describe('Evaluation domain controllers', () => {
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

  it('crea invitación persistida para un examen real', async () => {
    const invitationService = {
      createInvitation: jest.fn().mockResolvedValue({
        status: 'success',
        accessCode: 'IT-123456',
        directLink: '/exam/login?code=IT-123456',
      }),
    };
    const controller = new InvitationsController(invitationService as any);

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
    expect(invitationService.createInvitation).toHaveBeenCalledWith(
      staffUser,
      expect.objectContaining({ email: 'candidate@integrity.demo' }),
      expect.objectContaining({ ipAddress: null, userAgent: null }),
    );
  });

  it('claim crea candidato/intento y devuelve JWT real', async () => {
    const invitationService = {
      claimInvitation: jest.fn().mockResolvedValue({
        status: 'success',
        attemptId: '00000000-0000-7000-8000-000000000501',
        token: 'signed-jwt-token',
        message: 'Invitación reclamada con éxito. Sesión de evaluación inicializada.',
      }),
    };
    const controller = new InvitationsController(invitationService as any);

    const result = await controller.claimInvitation(
      { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } },
      {
        accessCode: 'IT-123456',
        candidateName: 'Candidato Demo',
        email: 'candidate@integrity.demo',
      },
    );

    expect(result.token).toBe('signed-jwt-token');
    expect(result.attemptId).toBe('00000000-0000-7000-8000-000000000501');
  });

  it('session devuelve preguntas sin correctConfig', async () => {
    const sessionService = {
      getAttemptSession: jest.fn().mockResolvedValue({
        attemptId: '00000000-0000-7000-8000-000000000501',
        questions: [
          {
            id: '00000000-0000-7000-8000-000000000201',
            content: { text: 'Pregunta' },
          },
        ],
      }),
    };
    const controller = new EvaluationSessionController(sessionService as any);

    const result = await controller.getAttemptSession(
      { user: candidateUser },
      '00000000-0000-7000-8000-000000000501',
    );

    expect(result.questions).toHaveLength(1);
    expect((result.questions[0] as any).content.correctConfig).toBeUndefined();
    expect(sessionService.getAttemptSession).toHaveBeenCalledWith(
      '00000000-0000-7000-8000-000000000501',
      candidateUser,
      expect.objectContaining({ ipAddress: null, userAgent: null }),
    );
  });

  it('submit encola respuesta', async () => {
    const responseService = {
      submitAnswer: jest.fn().mockResolvedValue({ status: 'accepted', jobId: 'job-1' }),
    };
    const controller = new ResponsesController(responseService as any);

    const result = await controller.submitAnswer(
      { user: candidateUser },
      '00000000-0000-7000-8000-000000000501',
      {
        questionId: '00000000-0000-7000-8000-000000000201',
        response: { selectedOptionId: 'b' },
      } as any,
    );

    expect(result.status).toBe('accepted');
    expect(responseService.submitAnswer).toHaveBeenCalled();
  });

  it('finalize es idempotente y consolida intento', async () => {
    const finalizeService = {
      finalizeAttempt: jest.fn().mockResolvedValue({
        status: 'COMPLETED',
        message: 'Intento finalizado y consolidado con las respuestas recibidas.',
      }),
    };
    const controller = new EvaluationFinalizeController(finalizeService as any);

    const result = await controller.finalizeAttempt(
      { user: candidateUser },
      '00000000-0000-7000-8000-000000000501',
    );

    expect(result.status).toBe('COMPLETED');
    expect(finalizeService.finalizeAttempt).toHaveBeenCalledWith(
      '00000000-0000-7000-8000-000000000501',
      candidateUser,
      expect.objectContaining({ ipAddress: null, userAgent: null }),
    );
  });

  it('no devuelve reporte cuando el UUID pertenece a otro tenant', async () => {
    const reportService = {
      getAttemptReport: jest.fn().mockRejectedValue(new BadRequestException('Intento de examen no encontrado.')),
    };
    const controller = new ReportsController(reportService as any);

    await expect(
      controller.getAttemptReport({ user: staffUser }, '00000000-0000-7000-8000-000000000999'),
    ).rejects.toThrow('Intento de examen no encontrado.');

    expect(reportService.getAttemptReport).toHaveBeenCalledWith(
      '00000000-0000-7000-8000-000000000999',
      staffUser,
      expect.objectContaining({ ipAddress: null, userAgent: null }),
    );
  });
});
