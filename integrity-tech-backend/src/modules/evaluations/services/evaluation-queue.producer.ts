import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SubmitAnswerDto, SubmitProctoringLogDto } from '../dto/submit-answer.dto';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class EvaluationQueueProducer {
  private readonly logger = new Logger(EvaluationQueueProducer.name);

  constructor(
    @InjectQueue('answers-queue') private readonly answersQueue: Queue,
    @InjectQueue('proctoring-queue') private readonly proctoringQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Encola la respuesta de una pregunta de forma asíncrona tras validar el estado del intento.
   */
  async enqueueAnswer(dto: SubmitAnswerDto): Promise<{ jobId: string }> {
    // 1. CONTROL DE SEGURIDAD Y VALIDACIÓN DE ESTADO (Pre-requisito de encolado)
    // En producción, aquí inyectamos el repositorio o puerto local para verificar:
    // a) Que el intento exista y su estado sea 'IN_PROGRESS'.
    // b) Que el tiempo actual no supere started_at + duration_minutes.
    // c) Que la pregunta pertenezca al examen del intento.
    const isAttemptValid = await this.verifyActiveAttempt(dto.attemptId, dto.questionId);
    if (!isAttemptValid) {
      throw new BadRequestException('El intento de examen no es válido o ya ha finalizado.');
    }

    // 2. ADICIÓN A LA COLA BULLMQ
    // Definimos un ID de trabajo determinista para lograr idempotencia si el cliente reenvía la petición por fallo de red
    const jobId = `ans:${dto.attemptId}:${dto.questionId}`;

    const job = await this.answersQueue.add(
      'save-answer',
      {
        attemptId: dto.attemptId,
        questionId: dto.questionId,
        response: dto.response,
        tiempoMs: dto.tiempoMs,
        submittedAt: new Date().toISOString(),
      },
      {
        jobId, // Idempotencia: BullMQ ignora el job si ya existe un ID idéntico en espera
        attempts: 5, // Número máximo de reintentos
        backoff: {
          type: 'exponential',
          delay: 2000, // Reintento inicial en 2s, luego 4s, 8s, 16s, etc.
        },
        removeOnComplete: true, // Limpiar de Redis al completarse con éxito para ahorrar RAM
        removeOnFail: false,   // Mantener en Redis si falla para auditoría y reintento manual
      },
    );

    this.logger.log(`Respuesta encolada con éxito. Job ID: ${job.id}`);
    return { jobId: job.id as string };
  }

  /**
   * Encola los logs de proctoring (telemetría de seguridad).
   */
  async enqueueProctoringLog(dto: SubmitProctoringLogDto): Promise<{ jobId: string }> {
    // Para los logs de proctoring no somos tan restrictivos con el estado del examen, 
    // pero sí validamos la existencia del intento.
    
    const job = await this.proctoringQueue.add(
      'save-log',
      {
        attemptId: dto.attemptId,
        eventType: dto.eventType,
        metadata: dto.metadata,
        timestamp: new Date().toISOString(),
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return { jobId: job.id as string };
  }

  /**
   * Simulación de verificación lógica rápida del estado del intento (Pre-Encolamiento).
   * En producción, esto consulta a Redis Cache o PostgreSQL de forma ultra-rápida.
   */
  private async verifyActiveAttempt(attemptId: string, questionId: string): Promise<boolean> {
    this.logger.debug(`Verificando validez del intento ${attemptId} para pregunta ${questionId}`);
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { examId: true, status: true, submittedAt: true },
    });

    if (!attempt) return false;
    if (attempt.status === 'COMPLETED') return this.isWithinLateAnswerWindow(attempt.submittedAt);
    if (attempt.status === 'SUBMITTED') return this.isWithinLateAnswerWindow(attempt.submittedAt);
    if (attempt.status !== 'IN_PROGRESS') return false;

    const examQuestion = await this.prisma.examQuestion.findFirst({
      where: {
        examId: attempt.examId,
        questionId,
      },
      select: { id: true },
    });

    return !!examQuestion;
  }

  private isWithinLateAnswerWindow(submittedAt: Date | null): boolean {
    if (!submittedAt) return false;
    const lateWindowMs = Number(process.env.LATE_ANSWER_WINDOW_MS || 5 * 60 * 1000);
    return lateWindowMs > 0 && Date.now() - submittedAt.getTime() <= lateWindowMs;
  }
}
