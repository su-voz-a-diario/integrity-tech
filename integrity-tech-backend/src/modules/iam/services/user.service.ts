import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    this.logger.log(`Consultando base de datos de IAM para permisos del usuario: ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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

    if (!user || !user.isActive) return false;

    return user.userRoles.some((userRole) =>
      userRole.role.rolePermissions.some((rolePermission) => rolePermission.permission.code === permission),
    );
  }
}
