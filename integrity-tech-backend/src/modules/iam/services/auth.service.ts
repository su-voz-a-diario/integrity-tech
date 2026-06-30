import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SessionUser } from '../iam.facade';

@Injectable()
export class AuthService {
  async verifyJwt(token: string): Promise<SessionUser> {
    // Simulación simple de desencriptado JWT
    if (token === 'valid-student-token') {
      return {
        userId: 'student-id',
        organizationId: 'org-12345',
        email: 'estudiante@universidad.edu',
      };
    }
    
    if (token === 'valid-teacher-token') {
      return {
        userId: 'teacher-id',
        organizationId: 'org-12345',
        email: 'profesor@universidad.edu',
      };
    }

    if (token && token.startsWith('candidate-session-token-')) {
      const parts = token.split('-');
      const userId = parts[parts.length - 1] || 'student-id';
      return {
        userId,
        organizationId: 'org-12345',
        email: 'candidato@evaluacion.com',
      };
    }

    throw new UnauthorizedException('Token de sesión inválido o expirado.');
  }
}
