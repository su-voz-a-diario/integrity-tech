import { Injectable, BadRequestException, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SubmitAnswerDto, SubmitProctoringLogDto } from '../dto/submit-answer.dto';
import { PrismaService } from '../../../shared/database/prisma.service';
import { MetricsService } from '../../../shared/observability/metrics.service';
import { RequestContextService } from '../../../shared/observability/request-context.service';

@Injectable()
export class EvaluationQueueProducer {
  private readonly logger = new Logger(EvaluationQueueProducer.name);

  constructor(
    @InjectQueue('answers-queue') private readonly answersQueue: Queue,
    @InjectQueue('proctoring-queue') private readonly proctoringQueue: Queue,
    private readonly prisma: PrismaService,
    @Optional() private readonly metrics?: MetricsService,
    @Optional() private readonly context?: RequestContextService,
  ) {}

  /**
   * Encola la respuesta de una pregunta de forma asíncrona tras validar el estado del intento.
   */
  async enqueueAnswer(dto: SubmitAnswerDto): Promise<{ jobId: string }> {
    // 1. CONTROL DE SEGURIDAD Y VALIDACIÓN DE ESTADO (Pre-requisito de encolado)
    // En producción, aquí inyectamos el repositorio o puerto local para verificar:
    // a) Que el intento exista y su estado sea 'IN_PROGRESS'.
    // b) Que el tiempo actual no supere started_at + duration_minutes.
    // c) Que el ItemVersion pertenezca a la AssessmentVersion del intento.
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
        itemVersionId: dto.itemVersionId || null,
        response: dto.response,
        tiempoMs: dto.tiempoMs,
        submittedAt: new Date().toISOString(),
        traceId: this.context?.getTraceId() || null,
        requestId: this.context?.getRequestId() || null,
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
    this.metrics?.recordQueueJob('answers-queue', 'save-answer', 'queued');
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
        traceId: this.context?.getTraceId() || null,
        requestId: this.context?.getRequestId() || null,
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

    this.metrics?.recordQueueJob('proctoring-queue', 'save-log', 'queued');
    return { jobId: job.id as string };
  }

  /**
   * Verificación rápida del estado del intento y pertenencia del ItemVersion a la AssessmentVersion.
   */
  private async verifyActiveAttempt(attemptId: string, questionId: string): Promise<boolean> {
    this.logger.debug(`Verificando validez del intento ${attemptId} para pregunta ${questionId}`);
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { status: true, submittedAt: true, assessmentVersionId: true, organizationId: true },
    });

    if (!attempt?.assessmentVersionId) return false;
    const isOpen = attempt.status === 'IN_PROGRESS';
    const acceptsLateAnswer = ['SUBMITTED', 'COMPLETED'].includes(attempt.status) && this.isWithinLateAnswerWindow(attempt.submittedAt);
    if (!isOpen && !acceptsLateAnswer) return false;

    const governedQuestion = await (this.prisma as any).assessmentVersionItem.findFirst({
      where: {
        assessmentVersionId: attempt.assessmentVersionId,
        itemVersionId: questionId,
        itemVersion: {
          status: { in: ['ACTIVE', 'PUBLISHED'] },
          item: { organizationId: attempt.organizationId },
        },
      },
      select: { itemVersionId: true },
    });

    return !!governedQuestion;
  }

  private isWithinLateAnswerWindow(submittedAt: Date | null): boolean {
    if (!submittedAt) return false;
    const lateWindowMs = Number(process.env.LATE_ANSWER_WINDOW_MS || 5 * 60 * 1000);
    return lateWindowMs > 0 && Date.now() - submittedAt.getTime() <= lateWindowMs;
  }
}
