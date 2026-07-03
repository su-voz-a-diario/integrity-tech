import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { OrganizationContextService } from '../../iam';
import { PERMISSIONS } from '../../iam/permissions';

@Injectable()
export class PsychometricsRoleGuard implements CanActivate {
  constructor(private readonly organizationContext: OrganizationContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const orgContext = await this.organizationContext.resolve(request.user);

    if (!orgContext.permissions.includes(PERMISSIONS.PSYCHOMETRICS_READ)) {
      throw new ForbiddenException('No tienes permisos para acceder a recursos psicométricos.');
    }

    return true;
  }
}
