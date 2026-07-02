import { Body, Controller, ForbiddenException, Post, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { IamFacade } from '../iam.facade';
import { IsString } from 'class-validator';

class DevLoginDto {
  @IsString()
  email: string;

  @IsString()
  password: string;
}

@Controller('auth')
export class DevAuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly iamFacade: IamFacade,
  ) {}

  @Post('dev-login')
  async devLogin(@Body() body: DevLoginDto) {
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEV_AUTH !== 'true') {
      throw new ForbiddenException('El login temporal de desarrollo está deshabilitado.');
    }

    const expectedEmail = process.env.DEMO_STAFF_EMAIL || 'admin@integrity.demo';
    const expectedPassword = process.env.DEMO_STAFF_PASSWORD || 'IntegrityDemo123!';

    if (body.email !== expectedEmail || body.password !== expectedPassword) {
      throw new UnauthorizedException('Credenciales demo inválidas.');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email: expectedEmail,
        isActive: true,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario demo no encontrado. Ejecuta npm run seed primero.');
    }

    const roles = user.userRoles.map((userRole) => userRole.role.name);
    const token = this.iamFacade.issueSessionToken({
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      roles,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        organizationId: user.organizationId,
        roles,
      },
    };
  }
}
