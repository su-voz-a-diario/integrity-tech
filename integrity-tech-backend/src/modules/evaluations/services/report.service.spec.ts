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
        mode: 'LEGACY_UNVERSIONED',
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
