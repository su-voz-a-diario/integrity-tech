import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { RolesGuard } from './roles.guard';
import { OrganizationContextService } from '../services/organization-context.service';
import { PERMISSIONS } from '../permissions';

describe('Centralized RBAC guards', () => {
  it('allows admin when required permission exists', async () => {
    const guard = buildPermissionsGuard([PERMISSIONS.ADMIN_MANAGE]);
    const ctx = mockExecutionContext({ userId: 'admin', organizationId: 'org-a' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('blocks recruiter from managing users', async () => {
    const guard = buildPermissionsGuard([PERMISSIONS.USERS_MANAGE]);
    const ctx = mockExecutionContext({ userId: 'recruiter', organizationId: 'org-a' });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks candidate from staff endpoints protected by permissions', async () => {
    const guard = buildPermissionsGuard([PERMISSIONS.ATTEMPTS_READ]);
    const ctx = mockExecutionContext({ userId: 'candidate', organizationId: 'org-a' });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks users without audit.read from reading audit events', async () => {
    const guard = buildPermissionsGuard([PERMISSIONS.AUDIT_READ]);
    const ctx = mockExecutionContext({ userId: 'recruiter', organizationId: 'org-a' });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows psychologist only on psychometric read permission', async () => {
    const readGuard = buildPermissionsGuard([PERMISSIONS.PSYCHOMETRICS_READ]);
    const writeGuard = buildPermissionsGuard([PERMISSIONS.PSYCHOMETRICS_WRITE]);
    const ctx = mockExecutionContext({ userId: 'psychologist', organizationId: 'org-a' });

    await expect(readGuard.canActivate(ctx)).resolves.toBe(true);
    await expect(writeGuard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks recruiter from psychometric editorial console', async () => {
    const guard = buildPermissionsGuard([PERMISSIONS.PSYCHOMETRICS_READ]);
    const ctx = mockExecutionContext({ userId: 'recruiter', organizationId: 'org-a' });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows evaluator to review through psychometric read permission', async () => {
    const guard = buildPermissionsGuard([PERMISSIONS.PSYCHOMETRICS_READ]);
    const ctx = mockExecutionContext({ userId: 'evaluator', organizationId: 'org-a' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('requires psychometric write permission for publish and retire actions', async () => {
    const readOnlyGuard = buildPermissionsGuard([PERMISSIONS.PSYCHOMETRICS_WRITE]);
    const writerGuard = buildPermissionsGuard([PERMISSIONS.PSYCHOMETRICS_WRITE]);

    await expect(
      readOnlyGuard.canActivate(mockExecutionContext({ userId: 'psychologist', organizationId: 'org-a' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      writerGuard.canActivate(mockExecutionContext({ userId: 'admin', organizationId: 'org-a' })),
    ).resolves.toBe(true);
  });

  it('uses RolesGuard through the same organization context service', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['admin']) } as any;
    const organizationContext = {
      requireRoles: jest.fn().mockResolvedValue({ roles: ['admin'] }),
    } as any;
    const guard = new RolesGuard(reflector, organizationContext);

    await expect(guard.canActivate(mockExecutionContext({ userId: 'admin', organizationId: 'org-a' }))).resolves.toBe(true);
    expect(organizationContext.requireRoles).toHaveBeenCalled();
  });

  function buildPermissionsGuard(requiredPermissions: string[]) {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(requiredPermissions) } as unknown as Reflector;
    const organizationContext = {
      requirePermissions: jest.fn(async (user, permissions) => {
        const userPermissions: Record<string, string[]> = {
          admin: [
            PERMISSIONS.ADMIN_MANAGE,
            PERMISSIONS.USERS_MANAGE,
            PERMISSIONS.ATTEMPTS_READ,
            PERMISSIONS.AUDIT_READ,
            PERMISSIONS.PSYCHOMETRICS_READ,
            PERMISSIONS.PSYCHOMETRICS_WRITE,
          ],
          recruiter: [PERMISSIONS.INVITATIONS_CREATE, PERMISSIONS.ATTEMPTS_READ],
          psychologist: [PERMISSIONS.PSYCHOMETRICS_READ],
          evaluator: [PERMISSIONS.PSYCHOMETRICS_READ],
          candidate: [],
        };
        const available = userPermissions[user.userId] || [];
        const missing = permissions.filter((permission) => !available.includes(permission));
        if (missing.length > 0) throw new ForbiddenException();
        return { permissions: available };
      }),
    } as unknown as OrganizationContextService;

    return new PermissionsGuard(reflector, organizationContext);
  }

  function mockExecutionContext(user: any): ExecutionContext {
    const request = { user };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  }
});
