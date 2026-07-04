import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../../shared/database/prisma.service';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { PermissionsGuard } from '../guards/permissions.guard';
import { PERMISSIONS } from '../permissions';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('users')
  @Permissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Listar usuarios staff/candidatos del tenant para administración' })
  listUsers(@Req() req: any) {
    return this.prisma.user.findMany({
      where: { organizationId: req.user.organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        userRoles: {
          select: { role: { select: { name: true } } },
        },
      },
    });
  }

  @Get('organization')
  @Permissions(PERMISSIONS.ORGANIZATION_MANAGE)
  @ApiOperation({ summary: 'Consultar organización actual del tenant' })
  getOrganization(@Req() req: any) {
    return this.prisma.organization.findFirst({
      where: { id: req.user.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        branding: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { users: true, assessments: true, examAttempts: true, candidateInvitations: true } },
      },
    });
  }
}
