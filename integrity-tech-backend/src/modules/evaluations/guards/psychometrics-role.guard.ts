import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class PsychometricsRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const roles: string[] = request.user?.roles || [];
    const allowed = ['admin', 'psychologist', 'evaluator'];

    if (!roles.some((role) => allowed.includes(role))) {
      throw new ForbiddenException('No tienes permisos para acceder a recursos psicométricos.');
    }

    return true;
  }
}
