import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SessionUser } from '../iam.facade';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class AuthService {
  private readonly issuer = 'integrity-tech';

  issueJwt(user: SessionUser, expiresInSeconds = 60 * 60 * 8): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.issuer,
      sub: user.userId,
      userId: user.userId,
      organizationId: user.organizationId,
      email: user.email,
      roles: user.roles || [],
      iat: now,
      exp: now + expiresInSeconds,
    };

    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.sign(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  async verifyJwt(token: string): Promise<SessionUser> {
    const parts = token?.split('.') || [];
    if (parts.length !== 3) {
      throw new UnauthorizedException('Token de sesión inválido.');
    }

    const [encodedHeader, encodedPayload, receivedSignature] = parts;
    const expectedSignature = this.sign(`${encodedHeader}.${encodedPayload}`);

    if (!this.safeCompare(receivedSignature, expectedSignature)) {
      throw new UnauthorizedException('Firma de token inválida.');
    }

    let payload: any;
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Payload de token inválido.');
    }

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      throw new UnauthorizedException('Token de sesión expirado.');
    }

    if (payload.iss !== this.issuer || !payload.userId || !payload.organizationId) {
      throw new UnauthorizedException('Token de sesión incompleto.');
    }

    return {
      userId: payload.userId,
      organizationId: payload.organizationId,
      email: payload.email || '',
      roles: Array.isArray(payload.roles) ? payload.roles : [],
    };
  }

  private sign(input: string): string {
    return createHmac('sha256', this.getSecret()).update(input).digest('base64url');
  }

  private base64UrlEncode(input: string): string {
    return Buffer.from(input).toString('base64url');
  }

  private getSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 16) {
      throw new UnauthorizedException('JWT_SECRET no está configurado correctamente.');
    }
    return secret;
  }

  private safeCompare(a: string, b: string): boolean {
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);
    return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
  }
}
