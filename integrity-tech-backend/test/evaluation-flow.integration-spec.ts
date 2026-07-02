import { AuthService } from '../src/modules/iam/services/auth.service';
import { PsychometricsRoleGuard } from '../src/modules/evaluations/guards/psychometrics-role.guard';

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

  it('permite psicometría solo para roles profesionales', () => {
    const guard = new PsychometricsRoleGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { roles: ['psychologist'] },
        }),
      }),
    };

    expect(guard.canActivate(context as any)).toBe(true);
  });

  it('bloquea psicometría para candidatos', () => {
    const guard = new PsychometricsRoleGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { roles: ['candidate'] },
        }),
      }),
    };

    expect(() => guard.canActivate(context as any)).toThrow();
  });
});
