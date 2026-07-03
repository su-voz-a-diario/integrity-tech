import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { MetricsService } from '../../../shared/observability/metrics.service';
import { AUDIT_ACTIONS, AuditRequestMetadata } from '../../audit/audit-event.types';
import { AuditService } from '../../audit/services/audit.service';
import { SessionUser } from '../../iam';
import { AttemptFinalized } from '../events/evaluation-domain.events';
import { AttemptRepository } from '../repositories/attempt.repository';
import { AnswersQueueProcessor } from './answers-queue.processor';

@Injectable()
export class FinalizeService {
  constructor(
    private readonly attempts: AttemptRepository,
    private readonly answersProcessor: AnswersQueueProcessor,
    private readonly auditService: AuditService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async finalizeAttempt(attemptId: string, user: SessionUser, metadata: AuditRequestMetadata = {}) {
    const organizationId = user.organizationId;
    const attempt = await this.attempts.findAttemptInTenant(attemptId, organizationId);
    if (!attempt) {
      throw new NotFoundException('Intento de examen no encontrado.');
    }

    if (attempt.status === 'COMPLETED') {
      void new AttemptFinalized(attempt.id, attempt.organizationId, attempt.status);
      await this.recordFinalizeAudit(attempt, user, metadata, attempt.status);
      this.metrics?.recordDomainEvent('AssessmentDelivery', 'finalize', 'idempotent');
      return {
        status: attempt.status,
        message: 'El intento ya había sido finalizado previamente.',
      };
    }

    if (attempt.status === 'SUBMITTED') {
      await this.answersProcessor.consolidateAttemptScore(attemptId);
      void new AttemptFinalized(attempt.id, attempt.organizationId, 'COMPLETED');
      await this.recordFinalizeAudit(attempt, user, metadata, 'COMPLETED');
      this.metrics?.recordDomainEvent('AssessmentDelivery', 'finalize', 'success');
      return {
        status: 'COMPLETED',
        message: 'El intento ya estaba enviado y fue consolidado nuevamente.',
      };
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException('El intento no puede finalizarse desde su estado actual.');
    }

    await this.attempts.markSubmitted(attemptId);
    await this.answersProcessor.consolidateAttemptScore(attemptId);
    void new AttemptFinalized(attempt.id, attempt.organizationId, 'COMPLETED');
    await this.recordFinalizeAudit(attempt, user, metadata, 'COMPLETED');
    this.metrics?.recordDomainEvent('AssessmentDelivery', 'finalize', 'success');

    return {
      status: 'COMPLETED',
      message: 'Intento finalizado y consolidado con las respuestas recibidas.',
    };
  }

  private recordFinalizeAudit(attempt: any, user: SessionUser, metadata: AuditRequestMetadata, finalStatus: string) {
    return this.auditService.record({
      organizationId: user.organizationId,
      actorUserId: user.userId,
      actorType: 'CANDIDATE',
      action: AUDIT_ACTIONS.ATTEMPT_FINALIZED,
      resourceType: 'ExamAttempt',
      resourceId: attempt.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadata: {
        previousStatus: attempt.status,
        finalStatus,
        examId: attempt.examId,
      },
    });
  }
}
