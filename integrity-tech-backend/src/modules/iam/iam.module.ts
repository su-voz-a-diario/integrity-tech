import { forwardRef, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { UserService } from './services/user.service';
import { AuthService } from './services/auth.service';
import { IamFacade } from './iam.facade';
import { IamLocalFacade } from './services/iam-local.facade';
import { DevAuthController } from './controllers/dev-auth.controller';
import { AuthController } from './controllers/auth.controller';
import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';
import { OrganizationContextService } from './services/organization-context.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { RateLimitGuard } from '../../shared/security/rate-limit.guard';
import { RedisRateLimitStore } from '../../shared/security/redis-rate-limit.store';
import { EncryptionService } from './services/encryption.service';

@Module({
  imports: [forwardRef(() => AuditModule)],
  controllers: [AuthController, DevAuthController],
  providers: [
    UserService, // Privado para el módulo IamModule
    AuthService, // Privado para el módulo IamModule
    PasswordService,
    SessionService,
    OrganizationContextService,
    PermissionsGuard,
    RolesGuard,
    RateLimitGuard,
    RedisRateLimitStore,
    EncryptionService,
    {
      provide: IamFacade,
      useClass: IamLocalFacade, // Vinculación de la abstracción con la implementación local monolítica
    },
  ],
  exports: [
    IamFacade, // Único componente público exportado
    OrganizationContextService,
    PermissionsGuard,
    RolesGuard,
    RateLimitGuard,
    RedisRateLimitStore,
    EncryptionService,
  ],
})
export class IamModule {}
