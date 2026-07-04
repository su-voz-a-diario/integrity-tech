import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { PasswordService } from '../services/password.service';

describe('AuthController', () => {
  const previousJwtSecret = process.env.JWT_SECRET;
  let authService: AuthService;
  let passwordService: PasswordService;
  let sessionService: any;
  let auditService: any;
  let prisma: any;
  let controller: AuthController;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-with-enough-length';
    authService = new AuthService();
    passwordService = new PasswordService();
    sessionService = {
      createSession: jest.fn().mockResolvedValue({
        sessionId: '00000000-0000-7000-8000-000000000901',
        refreshToken: 'refresh-token-value-with-enough-length',
        expiresAt: new Date(Date.now() + 86400000),
      }),
      refreshSession: jest.fn(),
      revokeSession: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      organization: {
        findUnique: jest.fn(),
      },
    };
    auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    controller = new AuthController(prisma, authService, passwordService, sessionService, auditService);
  });

  afterAll(() => {
    process.env.JWT_SECRET = previousJwtSecret;
  });

  it('logs in staff with a valid password and creates a revocable session', async () => {
    prisma.user.findFirst.mockResolvedValue(buildUser(['admin']));

    const result = await controller.login(
      { email: 'Admin@Integrity.Demo', password: 'IntegrityDemo123!' },
      mockRequest(),
    );

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBe('refresh-token-value-with-enough-length');
    expect(result.user.roles).toEqual(['admin']);
    expect(sessionService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@integrity.demo',
        organizationId: 'org-1',
      }),
      expect.any(Object),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.login.success',
        organizationId: 'org-1',
        actorUserId: 'user-1',
      }),
    );
  });


  it('rejects ambiguous multi-tenant email without organization slug', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]);

    await expect(
      controller.login({ email: 'shared@integrity.demo', password: 'IntegrityDemo123!' }, mockRequest()),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: null,
        action: 'auth.login.failed',
        metadata: expect.objectContaining({ reason: 'ambiguous_tenant' }),
      }),
    );
  });

  it('rejects an invalid password', async () => {
    prisma.user.findFirst.mockResolvedValue(buildUser(['admin']));

    await expect(
      controller.login({ email: 'admin@integrity.demo', password: 'wrong-password' }, mockRequest()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.login.failed',
        metadata: expect.objectContaining({ reason: 'invalid_password' }),
      }),
    );
  });

  it('audits failed login even when no organization can be resolved', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.organization.findUnique.mockResolvedValue(null);

    await expect(
      controller.login({ email: 'unknown@integrity.demo', password: 'IntegrityDemo123!' }, mockRequest()),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: null,
        action: 'auth.login.failed',
        metadata: expect.objectContaining({ reason: 'invalid_user_or_org' }),
      }),
    );
  });

  it('rejects non-staff users', async () => {
    prisma.user.findFirst.mockResolvedValue(buildUser(['candidate']));

    await expect(
      controller.login({ email: 'candidate@integrity.demo', password: 'IntegrityDemo123!' }, mockRequest()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refreshes an active session and returns a new access token', async () => {
    sessionService.refreshSession.mockResolvedValue({
      sessionId: 'session-1',
      user: {
        userId: 'user-1',
        organizationId: 'org-1',
        email: 'admin@integrity.demo',
        roles: ['admin'],
      },
    });

    const result = await controller.refresh({ refreshToken: 'refresh-token-value-with-enough-length' }, mockRequest());

    expect(result.accessToken).toBeDefined();
    expect(sessionService.refreshSession).toHaveBeenCalledWith('refresh-token-value-with-enough-length');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.refresh',
        resourceId: 'session-1',
      }),
    );
  });

  it('revokes the current session on logout', async () => {
    const result = await controller.logout({
      user: {
        userId: 'user-1',
        sessionId: 'session-1',
        organizationId: 'org-1',
      },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      get: jest.fn().mockReturnValue('jest'),
    } as any);

    expect(result).toEqual({ status: 'success' });
    expect(sessionService.revokeSession).toHaveBeenCalledWith('session-1', 'user-1');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.logout',
        resourceId: 'session-1',
      }),
    );
  });

  function buildUser(roles: string[]) {
    return {
      id: 'user-1',
      organizationId: 'org-1',
      email: 'admin@integrity.demo',
      passwordHash: passwordService.hashPassword('IntegrityDemo123!'),
      isActive: true,
      organization: {
        slug: 'integrity-demo',
        isActive: true,
      },
      userRoles: roles.map((name) => ({
        role: {
          name,
          rolePermissions: name === 'candidate'
            ? []
            : [{ permission: { code: 'attempts.read' } }],
        },
      })),
    };
  }

  function mockRequest() {
    return {
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      get: jest.fn().mockReturnValue('jest'),
    } as any;
  }
});
