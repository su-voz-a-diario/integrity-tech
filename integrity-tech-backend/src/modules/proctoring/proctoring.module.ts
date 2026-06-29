import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { IamModule } from '../iam';
import { ProctoringController } from './controllers/proctoring.controller';
import { ProctoringQueueProcessor } from './services/proctoring-queue.processor';

@Module({
  imports: [
    IamModule, // Importamos el módulo de identidad para la validación de tokens de JwtAuthGuard
    BullModule.registerQueue({
      name: 'proctoring-queue', // Registro de la cola de proctoring dedicada
    }),
  ],
  controllers: [
    ProctoringController,
  ],
  providers: [
    ProctoringQueueProcessor, // Registramos el Worker encargado de insertar y evaluar logs
  ],
})
export class ProctoringModule {}
