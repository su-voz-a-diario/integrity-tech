import { BadRequestException } from '@nestjs/common';
import { ReportService } from './report.service';

describe('ReportService audit events', () => {
  it('records audit event when staff accesses an attempt report', async () => {
    const reports = {
      findReportAttempt: jest.fn().mockResolvedValue({
        id: 'attempt-1',
        examId: 'exam-1',
        userId: 'candidate-1',
        organizationId: 'org-1',
        score: 80,
        scoreDetails: null,
        logs: [],
        startedAt: new Date('2026-07-02T00:00:00.000Z'),
        submittedAt: null,
        ipAddress: null,
        userAgent: null,
        ltiMapping: null,
      }),
      findUserInTenant: jest.fn().mockResolvedValue({
        firstName: 'Candidato',
        lastName: 'Demo',
        email: 'candidate@integrity.demo',
      }),
      findExamInTenant: jest.fn().mockResolvedValue({ title: 'Evaluación demo' }),
      findPublishedReportTemplateVersion: jest.fn().mockResolvedValue(null),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const scientificTrace = {
      buildAttemptTrace: jest.fn().mockResolvedValue({
        mode: 'UNVERSIONED',
        itemVersionIds: [],
        generatedAt: new Date().toISOString(),
      }),
      recordIssuedReport: jest.fn(),
    };
    const service = new ReportService(reports as any, {} as any, auditService as any, scientificTrace as any);

    await service.getAttemptReport(
      'attempt-1',
      {
        userId: 'admin-1',
        organizationId: 'org-1',
        email: 'admin@integrity.demo',
        roles: ['admin'],
      },
      { ipAddress: '127.0.0.1', userAgent: 'jest' },
    );

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'report.accessed',
        organizationId: 'org-1',
        actorUserId: 'admin-1',
        resourceId: 'attempt-1',
      }),
    );
  });


  it('returns Integrity Laboral profile when scoreDetails contains official assessment data', async () => {
    const reports = {
      findReportAttempt: jest.fn().mockResolvedValue({
        id: 'attempt-integrity',
        examId: 'exam-integrity',
        userId: 'candidate-1',
        organizationId: 'org-1',
        score: 82,
        scoreDetails: {
          SINCERIDAD: { name: 'Sinceridad', earned: 20, max: 25, percentage: 80 },
          JUSTICIA: { name: 'Justicia', earned: 14, max: 25, percentage: 56 },
          MODESTIA: { name: 'Modestia', earned: 23, max: 25, percentage: 92 },
          AUSENCIA_AVARICIA: { name: 'Ausencia de Avaricia', earned: 25, max: 25, percentage: 100 },
          integrityLaboral: {
            assessmentCode: 'EVALUACION_INTEGRIDAD_LABORAL',
            title: 'Perfil de Integridad Laboral',
            global: { name: 'Integridad Global', earned: 82, max: 100, percentage: 82 },
          },
        },
        logs: [],
        startedAt: new Date('2026-07-02T00:00:00.000Z'),
        submittedAt: new Date('2026-07-02T00:20:00.000Z'),
        ipAddress: null,
        userAgent: null,
        ltiMapping: null,
      }),
      findUserInTenant: jest.fn().mockResolvedValue({ firstName: 'Candidato', lastName: 'Demo', email: 'candidate@integrity.demo' }),
      findExamInTenant: jest.fn().mockResolvedValue({ title: 'Evaluación de Integridad Laboral' }),
      findPublishedReportTemplateVersion: jest.fn().mockResolvedValue(null),
    };
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const scientificTrace = {
      buildAttemptTrace: jest.fn().mockResolvedValue({ mode: 'VERSIONED', itemVersionIds: ['iv-1'], generatedAt: new Date().toISOString() }),
      recordIssuedReport: jest.fn(),
    };
    const service = new ReportService(reports as any, {} as any, auditService as any, scientificTrace as any);

    const result = await service.getAttemptReport('attempt-integrity', {
      userId: 'admin-1',
      organizationId: 'org-1',
      email: 'admin@integrity.demo',
      roles: ['admin'],
    });

    expect((result as any).integrityProfile.title).toBe('Perfil de Integridad Laboral');
    expect((result as any).integrityProfile.global.score).toBe(82);
    expect((result as any).integrityProfile.strengths.length).toBeGreaterThan(0);
    expect((result as any).integrityProfile.interviewQuestions).toEqual(
      expect.arrayContaining([expect.objectContaining({ dimension: 'Justicia' })]),
    );
  });

  it('does not audit report access when the attempt is not found in tenant', async () => {
    const reports = {
      findReportAttempt: jest.fn().mockResolvedValue(null),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const scientificTrace = {
      buildAttemptTrace: jest.fn(),
      recordIssuedReport: jest.fn(),
    };
    const service = new ReportService(reports as any, {} as any, auditService as any, scientificTrace as any);

    await expect(
      service.getAttemptReport('attempt-2', {
        userId: 'admin-1',
        organizationId: 'org-1',
        email: 'admin@integrity.demo',
        roles: ['admin'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(auditService.record).not.toHaveBeenCalled();
  });
});
