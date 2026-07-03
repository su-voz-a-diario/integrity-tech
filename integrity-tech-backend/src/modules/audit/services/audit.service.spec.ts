import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('records audit events without leaking failures to the main flow', async () => {
    const prisma = {
      auditEvent: {
        create: jest.fn().mockRejectedValue(new Error('db unavailable')),
      },
    };
    const service = new AuditService(prisma as any);

    await expect(
      service.record({
        organizationId: 'org-1',
        actorType: 'SYSTEM',
        action: 'test.action',
        resourceType: 'Test',
      }),
    ).resolves.toBeUndefined();
  });

  it('always scopes audit reads to the current organization', async () => {
    const prisma = {
      auditEvent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new AuditService(prisma as any);

    await service.findEvents('org-a', {
      resourceType: 'ExamAttempt',
      resourceId: 'attempt-1',
      actorUserId: 'user-1',
    });

    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-a',
          resourceType: 'ExamAttempt',
          resourceId: 'attempt-1',
          actorUserId: 'user-1',
        }),
      }),
    );
  });

  it('records public security events without organization', async () => {
    const prisma = {
      auditEvent: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new AuditService(prisma as any);

    await service.record({
      organizationId: null,
      actorType: 'SYSTEM',
      action: 'auth.login.failed',
      resourceType: 'User',
      metadata: { email: 'unknown@example.com' },
    });

    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: null,
          action: 'auth.login.failed',
        }),
      }),
    );
  });
});
