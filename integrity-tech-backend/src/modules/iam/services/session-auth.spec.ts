import { UnauthorizedException } from '@nestjs/common';
import { IamLocalFacade } from './iam-local.facade';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

describe('Session-backed auth', () => {
  const previousJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-with-enough-length';
  });

  afterAll(() => {
    process.env.JWT_SECRET = previousJwtSecret;
  });

  it('rejects a signed staff token when the database session is revoked or missing', async () => {
    const prisma: any = {
      userSession: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      user: {
        findFirst: jest.fn(),
      },
    };
    const authService = new AuthService();
    const sessionService = new SessionService(prisma);
    const facade = new IamLocalFacade({ hasPermission: jest.fn() } as any, authService, sessionService);
    const token = authService.issueAccessToken({
      userId: '00000000-0000-7000-8000-000000000001',
      organizationId: '00000000-0000-7000-8000-000000000002',
      email: 'admin@integrity.demo',
      roles: ['admin'],
      sessionId: '00000000-0000-7000-8000-000000000003',
    });

    await expect(facade.validateSession(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
