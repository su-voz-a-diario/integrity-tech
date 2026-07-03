import { AuthService } from '../src/modules/iam/services/auth.service';
import { PsychometricsRoleGuard } from '../src/modules/evaluations/guards/psychometrics-role.guard';
import { PERMISSIONS } from '../src/modules/iam/permissions';

describe('Fase 1 flujo estable (integración ligera)', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-key-12345';
  });

  it('emite y valida JWT staff real con roles', async () => {
    const auth = new AuthService();

    const token = auth.issueJwt({
      userId: '00000000-0000-7000-8000-000000000001',
      organizationId: '00000000-0000-7000-8000-000000000002',
      email: 'admin@integrity.demo',
      roles: ['admin'],
    });

    const session = await auth.verifyJwt(token);

    expect(session.userId).toBe('00000000-0000-7000-8000-000000000001');
    expect(session.organizationId).toBe('00000000-0000-7000-8000-000000000002');
    expect(session.roles).toContain('admin');
  });

  it('rechaza JWT inválido', async () => {
    const auth = new AuthService();

    await expect(auth.verifyJwt('valid-student-token')).rejects.toThrow();
  });

  it('permite psicometría solo con permiso profesional', async () => {
    const guard = new PsychometricsRoleGuard({
      resolve: jest.fn().mockResolvedValue({
        permissions: [PERMISSIONS.PSYCHOMETRICS_READ],
      }),
    } as any);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: 'psychologist', organizationId: 'org-a' },
        }),
      }),
    };

    await expect(guard.canActivate(context as any)).resolves.toBe(true);
  });

  it('bloquea psicometría para candidatos sin permiso', async () => {
    const guard = new PsychometricsRoleGuard({
      resolve: jest.fn().mockResolvedValue({
        permissions: [],
      }),
    } as any);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: 'candidate', organizationId: 'org-a' },
        }),
      }),
    };

    await expect(guard.canActivate(context as any)).rejects.toThrow();
  });
});
