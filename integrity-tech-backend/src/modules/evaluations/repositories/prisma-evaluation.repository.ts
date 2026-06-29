import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { EvaluationRepository } from './evaluation.repository';
import { ExamAttempt } from '@prisma/client';

@Injectable()
export class PrismaEvaluationRepository implements EvaluationRepository {
  private readonly logger = new Logger(PrismaEvaluationRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async startAttemptWithLog(data: {
    examId: string;
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    initialLogEvent: string;
    initialLogMetadata?: Record<string, any>;
  }): Promise<ExamAttempt> {
    this.logger.log(`Iniciando transacción interactiva para registrar intento de examen del usuario: ${data.userId}`);
    
    // Transacción Interactiva: Garantiza atomicidad completa. 
    // Si la creación del intento de examen tiene éxito, pero falla la creación de la bitácora inicial,
    // toda la transacción se revierte (Rollback) para evitar estados inconsistentes (intento sin logs).
    return this.prisma.$transaction(async (tx) => {
      
      // 1. Crear el registro del intento en base de datos
      const attempt = await tx.examAttempt.create({
        data: {
          examId: data.examId,
          userId: data.userId,
          status: 'IN_PROGRESS',
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });

      // 2. Crear la bitácora de proctoring correspondiente al evento de inicio
      await tx.attemptLog.create({
        data: {
          examAttemptId: attempt.id, // Enlazado al ID del intento recién creado en la transacción
          eventType: data.initialLogEvent,
          metadata: data.initialLogMetadata || {},
        },
      });

      this.logger.log(`Transacción exitosa. Intento creado: ${attempt.id}`);
      return attempt;
    });
  }
}
