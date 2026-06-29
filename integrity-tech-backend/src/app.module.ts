import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from './shared/database/database.module';
import { IamModule } from './modules/iam';
import { ExamsModule } from './modules/exams/exams.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { ProctoringModule } from './modules/proctoring/proctoring.module';
import { LtiModule } from './modules/lti/lti.module';

@Module({
  imports: [
    // 1. Configuración global de la conexión a Redis para las colas BullMQ
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        keyPrefix: 'evaluartest:',
        maxRetriesPerRequest: null,
      },
    }),

    // 2. Módulo de comunicación por eventos desacoplada
    EventEmitterModule.forRoot(),

    // 3. Módulo de base de datos relacional global (Prisma)
    DatabaseModule,

    // 4. Módulos de Dominios Acotados (Bounded Contexts)
    IamModule,
    ExamsModule,
    EvaluationsModule,
    ProctoringModule,
    LtiModule, // Integración LTI v1.3
  ],
})
export class AppModule {}
