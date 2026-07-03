import { ForbiddenException } from '@nestjs/common';
import { CandidateConsentService, CURRENT_CANDIDATE_CONSENT_VERSION } from './candidate-consent.service';

describe('CandidateConsentService', () => {
  const user = {
    userId: '00000000-0000-7000-8000-000000000003',
    organizationId: '00000000-0000-7000-8000-000000000002',
  };
  const attempt = {
    id: '00000000-0000-7000-8000-000000000501',
    organizationId: user.organizationId,
    userId: user.userId,
  };

  let prisma: any;
  let attempts: any;
  let auditService: any;
  let service: CandidateConsentService;

  beforeEach(() => {
    prisma = {
      candidateConsent: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };
    attempts = {
      findAttemptInTenant: jest.fn().mockResolvedValue(attempt),
    };
    auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    service = new CandidateConsentService(prisma, attempts, auditService);
  });

  it('returns false when the candidate has not accepted consent', async () => {
    prisma.candidateConsent.findUnique.mockResolvedValue(null);

    await expect(service.hasConsent(attempt.id, user)).resolves.toBe(false);
  });

  it('accepts consent idempotently for an owned attempt', async () => {
    prisma.candidateConsent.upsert.mockResolvedValue({
      id: 'consent-1',
      consentVersion: CURRENT_CANDIDATE_CONSENT_VERSION,
      acceptedAt: new Date('2026-07-02T00:00:00.000Z'),
    });

    const result = await service.acceptConsent(
      attempt.id,
      user,
      {},
      { ipAddress: '127.0.0.1', userAgent: 'jest' },
    );

    expect(result.accepted).toBe(true);
    expect(prisma.candidateConsent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { attemptId: attempt.id },
        update: {},
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'candidate.consent.accepted',
        organizationId: user.organizationId,
        actorUserId: user.userId,
      }),
    );
  });

  it('rejects consent for an attempt owned by another candidate', async () => {
    attempts.findAttemptInTenant.mockResolvedValue({
      ...attempt,
      userId: '00000000-0000-7000-8000-000000000099',
    });

    await expect(service.hasConsent(attempt.id, user)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
