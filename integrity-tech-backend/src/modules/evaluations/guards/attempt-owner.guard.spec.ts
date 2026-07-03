import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttemptOwnerGuard } from './attempt-owner.guard';

describe('AttemptOwnerGuard tenant isolation', () => {
  it('allows owner inside the same organization', async () => {
    const guard = new AttemptOwnerGuard({
      examAttempt: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 'user-a',
          organizationId: 'org-a',
        }),
      },
    } as any);

    await expect(guard.canActivate(mockContext('user-a', 'org-a', 'attempt-a'))).resolves.toBe(true);
  });

  it('blocks a known UUID from another tenant', async () => {
    const guard = new AttemptOwnerGuard({
      examAttempt: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 'user-a',
          organizationId: 'org-b',
        }),
      },
    } as any);

    await expect(guard.canActivate(mockContext('user-a', 'org-a', 'attempt-b'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns not found when attempt does not exist', async () => {
    const guard = new AttemptOwnerGuard({
      examAttempt: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any);

    await expect(guard.canActivate(mockContext('user-a', 'org-a', 'missing'))).rejects.toBeInstanceOf(NotFoundException);
  });

  function mockContext(userId: string, organizationId: string, attemptId: string) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId, organizationId },
          params: { attemptId },
        }),
      }),
    } as any;
  }
});
