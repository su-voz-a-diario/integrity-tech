import { Process, Processor } from '@nestjs/bull';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../shared/database/prisma.service';
import { GradingStrategyFactory } from './grading-strategy';
import { EvaluationGovernanceResolverService } from '../../psychometric-governance/services/evaluation-governance-resolver.service';
import { MetricsService } from '../../../shared/observability/metrics.service';
import { RequestContextService } from '../../../shared/observability/request-context.service';

@Processor('answers-queue')
export class AnswersQueueProcessor {
  private readonly logger = new Logger(AnswersQueueProcessor.name);

  constructor(
    private readonly prisma: PrismaService, // Inyectamos Prisma para la persistencia transaccional
    private readonly eventEmitter: EventEmitter2, // Inyectamos el emisor de eventos para comunicación desacoplada
    private readonly governanceResolver: EvaluationGovernanceResolverService,
    @Optional() private readonly metrics?: MetricsService,
    @Optional() private readonly context?: RequestContextService,
  ) {}

  @Process('save-answer')
  async handleSaveAnswer(job: Job<any>) {
    const { attemptId, questionId, itemVersionId, response, tiempoMs, submittedAt } = job.data;
    
    this.logger.log(`[Worker] Procesando respuesta. Job: ${job.id} | Intento: ${attemptId} | Tiempo de respuesta: ${tiempoMs || 0}ms`);

    try {
      // 1. OBTENER INFORMACIÓN DE LA PREGUNTA (Desde DB / Caché)
      const question = await this.prisma.question.findUnique({
        where: { id: questionId },
        select: { type: true, contentJsonb: true, defaultPoints: true },
      });
      this.metrics?.recordQueueJob('answers-queue', 'save-answer', 'completed');

      if (!question) {
        throw new Error(`Pregunta con ID ${questionId} no encontrada.`);
      }

      const belongsToAttempt = await this.governanceResolver.validateItemVersionBelongsToAttempt({
        attemptId,
        questionId,
        itemVersionId: itemVersionId || null,
      });

      if (!belongsToAttempt) {
        throw new Error(`Reactivo ${questionId} no pertenece a la versión psicométrica del intento ${attemptId}.`);
      }

      // 2. APLICAR EL PATRÓN ESTRATEGIA PARA OBTENER CALIFICACIÓN
      const strategy = GradingStrategyFactory.getStrategy(question.type);
      
      // El campo contentJsonb del JSONB contiene las claves correctas (ej. correctOptionId o correctAnswers)
      const content = question.contentJsonb as any;
      const questionPoints = Number(question.defaultPoints);
      
      const { isCorrect, pointsEarned } = strategy.grade(response, content.correctConfig || {}, questionPoints);

      // 3. GUARDAR EN POSTGRESQL (UPSERT IDEMPOTENTE)
      await this.prisma.answerSubmission.upsert({
        where: {
          unique_response_per_attempt_question: {
            examAttemptId: attemptId,
            questionId,
          },
        },
        update: {
          response,
          itemVersionId: itemVersionId || null,
          isCorrect,
          pointsEarned,
          tiempoMs,
          submittedAt: new Date(submittedAt),
        },
        create: {
          examAttemptId: attemptId,
          questionId,
          itemVersionId: itemVersionId || null,
          response,
          isCorrect,
          pointsEarned,
          tiempoMs,
          submittedAt: new Date(submittedAt),
        },
      });

      // 4. Consolidación sin contador Redis: si el intento ya fue finalizado,
      // recalculamos de forma idempotente con las respuestas persistidas.
      const attempt = await this.prisma.examAttempt.findUnique({
        where: { id: attemptId },
        select: { status: true, submittedAt: true },
      });

      if (attempt && ['SUBMITTED', 'COMPLETED'].includes(attempt.status)) {
        this.logger.log(`[Worker] Respuesta procesada para intento finalizado ${attemptId}. Recalculando consolidación...`);
        await this.consolidateAttemptScore(attemptId);
      }

    } catch (error) {
      this.metrics?.recordQueueJob('answers-queue', 'save-answer', 'failed');
      this.logger.error(`Error procesando respuesta en Job ${job.id}: ${error.message}`);
      throw error; // Arrojar error activa el backoff y reintentos automáticos de BullMQ
    }
  }

  /**
   * Consolidación final del puntaje del intento de Assessment (Evaluación) en una sola transacción atómica.
   * Evita condiciones de carrera mediante Pessimistic Locking (SELECT FOR UPDATE) en PostgreSQL.
   * Calcula el puntaje total y el desglose de perfil psicométrico por dimensiones.
   */
  async consolidateAttemptScore(attemptId: string): Promise<void> {
    let finalScore: number;
    await this.prisma.$transaction(async (tx) => {
      // 1. ADQUIRIR BLOQUEO PESIMISTA (FOR UPDATE)
      const attempts = await tx.$queryRaw<any[]>`
        SELECT id, status FROM exam_attempts 
        WHERE id = ${attemptId}::uuid 
        FOR UPDATE;
      `;
      
      const attempt = attempts[0];
      if (!attempt) {
        throw new Error(`Intento ${attemptId} no encontrado para consolidación.`);
      }

      // 2. RECUPERAR RESPUESTAS Y PREGUNTAS ASOCIADAS
      const submissions = await tx.answerSubmission.findMany({
        where: { examAttemptId: attemptId },
        select: {
          questionId: true,
          itemVersionId: true,
          pointsEarned: true,
        },
      });

      const questionIds = submissions.map((s) => s.questionId);
      const questions = await tx.question.findMany({
        where: { id: { in: questionIds } },
        select: {
          id: true,
          defaultPoints: true,
          contentJsonb: true,
        },
      });

      // 3. AGRUPACIÓN Y CÁLCULO POR DIMENSIONES PSICOMÉTRICAS
      const questionsMap = new Map(questions.map((q) => [q.id, q]));
      const dimensionsMap: Record<string, { earned: number; max: number }> = {};
      let totalScore = 0;

      for (const sub of submissions) {
        const question = questionsMap.get(sub.questionId);
        if (!question) continue;

        const points = Number(sub.pointsEarned);
        const maxPoints = Number(question.defaultPoints);
        totalScore += points;

        // Obtener la dimensión declarada en el JSONB de la pregunta (por defecto 'GENERAL')
        const content = question.contentJsonb as any;
        const dimension = content?.dimension || 'GENERAL';

        if (!dimensionsMap[dimension]) {
          dimensionsMap[dimension] = { earned: 0, max: 0 };
        }
        dimensionsMap[dimension].earned += points;
        dimensionsMap[dimension].max += maxPoints;
      }

      // Estructurar el perfil psicométrico detallado para el reporte de RRHH
      const scoreDetails: Record<string, { earned: number; max: number; percentage: number }> = {};
      for (const [dim, data] of Object.entries(dimensionsMap)) {
        scoreDetails[dim] = {
          earned: Number(data.earned.toFixed(2)),
          max: Number(data.max.toFixed(2)),
          percentage: data.max > 0 ? Number(((data.earned / data.max) * 100).toFixed(1)) : 0,
        };
      }

      // 4. ACTUALIZAR INTENTO A ESTADO COMPLETADO CON EL DESGLOSE JSONB
      await tx.examAttempt.update({
        where: { id: attemptId },
        data: {
          score: totalScore,
          scoreDetails: scoreDetails as any, // Persistencia de la telemetría psicométrica
          status: 'COMPLETED',
          submittedAt: new Date(),
        },
      });

      this.logger.log(`[Consolidación] Intento ${attemptId} calificado. Nota: ${totalScore} | Perfil: ${JSON.stringify(scoreDetails)}`);
      finalScore = totalScore;
    });

    // 5. EMITIR EVENTO FUERA DE LA TRANSACCIÓN (Desacoplamiento LTI)
    if (finalScore !== undefined) {
      this.eventEmitter.emit('exam.attempt.completed', {
        attemptId,
        score: finalScore,
      });
    }
  }
}
