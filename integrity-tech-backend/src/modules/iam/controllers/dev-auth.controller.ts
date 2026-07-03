import { Body, Controller, ForbiddenException, Post, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';

class DevLoginDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password: string;
}

@Controller('auth')
export class DevAuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
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
        organization: true,
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
    if (!user.organization?.isActive) {
      throw new UnauthorizedException('Organización demo inactiva.');
    }

    const session = await this.sessionService.createSession({
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      roles,
    });
    const accessToken = this.authService.issueAccessToken({
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      roles,
      sessionId: session.sessionId,
    });

    return {
      accessToken,
      token: accessToken,
      refreshToken: session.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        organizationId: user.organizationId,
        roles,
      },
    };
  }
}
