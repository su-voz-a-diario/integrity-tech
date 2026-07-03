import { ArchiveService } from './archive.service';
import { DataDeletionService } from './data-deletion.service';
import { RetentionService } from './retention.service';

describe('Data governance foundation', () => {
  const audit = { record: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates default retention policies per organization', async () => {
    const prisma = {
      retentionPolicy: {
        upsert: jest.fn().mockResolvedValue({ id: 'policy-1' }),
      },
    };
    const service = new RetentionService(prisma as any, audit as any);

    const policies = await service.ensureDefaultPolicies('org-1', 'user-1');

    expect(policies.length).toBeGreaterThanOrEqual(8);
    expect(prisma.retentionPolicy.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_dataType: {
            organizationId: 'org-1',
            dataType: 'CANDIDATE',
          },
        },
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        action: 'data.retention.defaults_ensured',
      }),
    );
  });

  it('registers active highly sensitive candidate lifecycle records', async () => {
    const prisma = {
      dataLifecycleRecord: {
        upsert: jest.fn().mockResolvedValue({ id: 'life-1', state: 'ACTIVE' }),
      },
    };
    const service = new ArchiveService(prisma as any, audit as any);

    await service.registerActiveResource({
      organizationId: 'org-1',
      resourceType: 'CANDIDATE',
      resourceId: 'candidate-1',
      actorUserId: 'staff-1',
    });

    expect(prisma.dataLifecycleRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          organizationId: 'org-1',
          resourceType: 'CANDIDATE',
          resourceId: 'candidate-1',
          classification: 'HIGHLY_SENSITIVE',
          state: 'ACTIVE',
        }),
      }),
    );
  });

  it('plans candidate deletion without physically deleting data', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'candidate-1' }) },
      examAttempt: { findMany: jest.fn().mockResolvedValue([{ id: 'attempt-1' }]) },
      candidateConsent: { findMany: jest.fn().mockResolvedValue([{ id: 'consent-1' }]) },
      userSession: { findMany: jest.fn().mockResolvedValue([{ id: 'session-1' }]) },
      auditEvent: { findMany: jest.fn().mockResolvedValue([{ id: 'audit-1' }]) },
    };
    const service = new DataDeletionService(prisma as any, audit as any);

    const plan = await service.planDeletion('org-1', 'CANDIDATE', 'candidate-1');

    expect(plan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resourceType: 'CANDIDATE', plannedAction: 'SOFT_DELETE' }),
        expect.objectContaining({ resourceType: 'ATTEMPT', plannedAction: 'ARCHIVE' }),
        expect.objectContaining({ resourceType: 'SESSION', plannedAction: 'REVOKE' }),
      ]),
    );
    expect((prisma.user as any).delete).toBeUndefined();
  });

  it('does not approve deletion requests from another organization', async () => {
    const prisma = {
      dataDeletionRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const service = new DataDeletionService(prisma as any, audit as any);

    await expect(service.approveRequest('request-1', 'org-1', 'staff-1')).rejects.toThrow(
      'Solicitud no disponible',
    );
    expect(prisma.dataDeletionRequest.update).not.toHaveBeenCalled();
  });
});
