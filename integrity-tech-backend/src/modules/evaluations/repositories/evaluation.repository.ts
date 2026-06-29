import { ExamAttempt } from '@prisma/client';

export abstract class EvaluationRepository {
  /**
   * Crea un intento de examen y registra el log inicial de proctoring en una sola transacción atómica.
   */
  abstract startAttemptWithLog(data: {
    examId: string;
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    initialLogEvent: string;
    initialLogMetadata?: Record<string, any>;
  }): Promise<ExamAttempt>;
}
