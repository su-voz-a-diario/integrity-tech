import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { IamFacade } from '../../modules/iam/iam.facade';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly iamFacade: IamFacade) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Falta la cabecera de Autorización.');
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Formato de token inválido. Use "Bearer <token>".');
    }

    try {
      // Delegamos la validación del JWT de sesión a la Fachada de Identidad
      const user = await this.iamFacade.validateSession(token);
      
      // Adjuntamos el usuario decodificado a la petición HTTP para que esté disponible en Guards y Controllers posteriores
      request.user = user;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Sesión de usuario inválida o expirada.');
    }
  }
}
