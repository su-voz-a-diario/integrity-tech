import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SessionUser } from '../iam.facade';

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface CreatedSession {
  sessionId: string;
  refreshToken: string;
  expiresAt: Date;
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(user: SessionUser, metadata: RequestMetadata = {}): Promise<CreatedSession> {
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.getRefreshTtlMs());
    const session = await (this.prisma as any).userSession.create({
      data: {
        userId: user.userId,
        organizationId: user.organizationId,
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        expiresAt,
      },
    });

    return {
      sessionId: session.id,
      refreshToken,
      expiresAt,
    };
  }

  async refreshSession(refreshToken: string): Promise<{ user: SessionUser; sessionId: string }> {
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const session = await (this.prisma as any).userSession.findFirst({
      where: {
        refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            organization: true,
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    if (!session || !session.user?.isActive || !session.user.organization?.isActive) {
      throw new UnauthorizedException('Refresh token inválido, revocado o expirado.');
    }

    await (this.prisma as any).userSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      sessionId: session.id,
      user: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
        email: session.user.email,
        roles: session.user.userRoles.map((userRole) => userRole.role.name),
        sessionId: session.id,
      },
    };
  }

  async assertActiveSession(user: SessionUser): Promise<SessionUser> {
    if (!user.sessionId) {
      if (user.roles.length === 1 && user.roles[0] === 'candidate') {
        return this.assertLegacyCandidateSession(user);
      }

      throw new UnauthorizedException('La sesión no es revocable o no contiene sessionId.');
    }

    const session = await (this.prisma as any).userSession.findFirst({
      where: {
        id: user.sessionId,
        userId: user.userId,
        organizationId: user.organizationId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            organization: true,
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    if (!session || !session.user?.isActive || !session.user.organization?.isActive) {
      throw new UnauthorizedException('Sesión revocada, expirada o inválida.');
    }

    return {
      userId: session.user.id,
      organizationId: session.user.organizationId,
      email: session.user.email,
      roles: session.user.userRoles.map((userRole) => userRole.role.name),
      sessionId: session.id,
      jti: user.jti,
    };
  }

  async revokeSession(sessionId: string, userId?: string): Promise<void> {
    await (this.prisma as any).userSession.updateMany({
      where: {
        id: sessionId,
        ...(userId ? { userId } : {}),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private async assertLegacyCandidateSession(user: SessionUser): Promise<SessionUser> {
    const activeUser = await this.prisma.user.findFirst({
      where: {
        id: user.userId,
        organizationId: user.organizationId,
        isActive: true,
        organization: { isActive: true },
      },
    });

    if (!activeUser) {
      throw new UnauthorizedException('Sesión de candidato inválida.');
    }

    return user;
  }

  private getRefreshTtlMs(): number {
    const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
    return days * 24 * 60 * 60 * 1000;
  }
}
