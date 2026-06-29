import { Module } from '@nestjs/common';
import { UserService } from './services/user.service';
import { AuthService } from './services/auth.service';
import { IamFacade } from './iam.facade';
import { IamLocalFacade } from './services/iam-local.facade';

@Module({
  providers: [
    UserService, // Privado para el módulo IamModule
    AuthService, // Privado para el módulo IamModule
    {
      provide: IamFacade,
      useClass: IamLocalFacade, // Vinculación de la abstracción con la implementación local monolítica
    },
  ],
  exports: [
    IamFacade, // Único componente público exportado
  ],
})
export class IamModule {}
