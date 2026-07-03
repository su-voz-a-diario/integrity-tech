import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SessionUser } from '../iam.facade';

export interface OrganizationContext {
  userId: string;
  organizationId: string;
  email: string;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class OrganizationContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(user: SessionUser): Promise<OrganizationContext> {
    if (!user?.userId || !user.organizationId) {
      throw new UnauthorizedException('No hay contexto de organización en la sesión.');
    }

    const dbUser = await this.prisma.user.findFirst({
      where: {
        id: user.userId,
        organizationId: user.organizationId,
        isActive: true,
        organization: { isActive: true },
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!dbUser) {
      throw new UnauthorizedException('Usuario u organización inactivos o inválidos.');
    }

    const roles = dbUser.userRoles.map((userRole) => userRole.role.name);
    const permissions = Array.from(
      new Set(
        dbUser.userRoles.flatMap((userRole) =>
          userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.code),
        ),
      ),
    );

    return {
      userId: dbUser.id,
      organizationId: dbUser.organizationId,
      email: dbUser.email,
      roles,
      permissions,
    };
  }

  async requirePermissions(user: SessionUser, requiredPermissions: string[]): Promise<OrganizationContext> {
    const context = await this.resolve(user);
    const missing = requiredPermissions.filter((permission) => !context.permissions.includes(permission));
    if (missing.length > 0) {
      throw new ForbiddenException('No tienes permisos para acceder a este recurso.');
    }
    return context;
  }

  async requireRoles(user: SessionUser, requiredRoles: string[]): Promise<OrganizationContext> {
    const context = await this.resolve(user);
    const allowed = requiredRoles.some((role) => context.roles.includes(role));
    if (!allowed) {
      throw new ForbiddenException('No tienes rol suficiente para acceder a este recurso.');
    }
    return context;
  }
}
