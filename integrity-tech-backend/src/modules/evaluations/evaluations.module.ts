import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { IamModule } from '../iam';
import { EvaluationController } from './controllers/evaluation.controller';
import { EvaluationQueueProducer } from './services/evaluation-queue.producer';
import { AnswersQueueProcessor } from './services/answers-queue.processor';
import { ProctoringQueueProcessor } from './services/proctoring-queue.processor';

@Module({
  imports: [
    IamModule, // Necesario para que JwtAuthGuard pueda inyectar IamFacade
    BullModule.registerQueue(
      {
        name: 'answers-queue',
      },
      {
        name: 'proctoring-queue',
      },
    ),
  ],
  controllers: [
    EvaluationController, // Registramos el controlador HTTP REST
  ],
  providers: [
    EvaluationQueueProducer,
    AnswersQueueProcessor,
    ProctoringQueueProcessor,
  ],
  exports: [
    EvaluationQueueProducer,
  ],
})
export class EvaluationsModule {}
