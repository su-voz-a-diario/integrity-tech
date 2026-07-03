import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../audit/services/audit.service';
import { DataDeletionRequestInput, DataSubjectType } from '../data-governance.types';

interface PlannedDeletionItem {
  resourceType: DataSubjectType | string;
  resourceId: string;
  plannedAction: 'ARCHIVE' | 'SOFT_DELETE' | 'PURGE_REVIEW' | 'REVOKE';
  metadata?: Record<string, unknown>;
}

@Injectable()
export class DataDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createDeletionRequest(input: DataDeletionRequestInput) {
    const plannedItems = await this.planDeletion(input.organizationId, input.subjectType, input.subjectId);
    if (plannedItems.length === 0) {
      throw new NotFoundException('No se encontraron datos gobernables para la solicitud');
    }

    const request = await (this.prisma as any).dataDeletionRequest.create({
      data: {
        organizationId: input.organizationId,
        requestedByUserId: input.requestedByUserId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        reason: input.reason,
        dryRun: input.dryRun ?? true,
        status: 'PENDING_REVIEW',
        items: {
          create: plannedItems.map((item) => ({
            resourceType: item.resourceType,
            resourceId: item.resourceId,
            plannedAction: item.plannedAction,
            metadata: item.metadata || undefined,
          })),
        },
      },
      include: { items: true },
    });

    await this.audit.record({
      organizationId: input.organizationId,
      actorUserId: input.requestedByUserId,
      actorType: 'STAFF',
      action: 'data.deletion.requested',
      resourceType: input.subjectType,
      resourceId: input.subjectId,
      metadata: {
        requestId: request.id,
        dryRun: request.dryRun,
        plannedItems: plannedItems.length,
      },
    });

    return request;
  }

  async approveRequest(requestId: string, organizationId: string, approvedByUserId: string) {
    const existing = await (this.prisma as any).dataDeletionRequest.findFirst({
      where: { id: requestId, organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Solicitud no disponible');
    }

    const request = await (this.prisma as any).dataDeletionRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedByUserId,
        approvedAt: new Date(),
      },
      include: { items: true },
    });

    await this.audit.record({
      organizationId,
      actorUserId: approvedByUserId,
      actorType: 'STAFF',
      action: 'data.deletion.approved',
      resourceType: request.subjectType,
      resourceId: request.subjectId,
      metadata: { requestId },
    });

    return request;
  }

  async planDeletion(
    organizationId: string,
    subjectType: DataSubjectType,
    subjectId: string,
  ): Promise<PlannedDeletionItem[]> {
    switch (subjectType) {
      case 'CANDIDATE':
        return this.planCandidateDeletion(organizationId, subjectId);
      case 'ATTEMPT':
        return this.planAttemptDeletion(organizationId, subjectId);
      case 'ORGANIZATION':
        return this.planOrganizationDeletion(organizationId, subjectId);
      case 'SESSION':
        return this.planSessionDeletion(organizationId, subjectId);
      case 'CONSENT':
        return this.planConsentDeletion(organizationId, subjectId);
      case 'AUDIT':
        return this.planAuditDeletion(organizationId, subjectId);
      case 'SNAPSHOT':
      case 'PROCTORING_EVENT':
        return this.planProctoringDeletion(organizationId, subjectId);
      default:
        return [];
    }
  }

  private async planCandidateDeletion(organizationId: string, userId: string) {
    const candidate = await (this.prisma as any).user.findFirst({ where: { id: userId, organizationId } });
    if (!candidate) return [];

    const [attempts, consents, sessions, auditEvents] = await Promise.all([
      (this.prisma as any).examAttempt.findMany({ where: { organizationId, userId }, select: { id: true } }),
      (this.prisma as any).candidateConsent.findMany({ where: { organizationId, userId }, select: { id: true } }),
      (this.prisma as any).userSession.findMany({ where: { organizationId, userId }, select: { id: true } }),
      (this.prisma as any).auditEvent.findMany({ where: { organizationId, actorUserId: userId }, select: { id: true } }),
    ]);

    return [
      { resourceType: 'CANDIDATE', resourceId: userId, plannedAction: 'SOFT_DELETE' as const },
      ...attempts.map((item) => ({ resourceType: 'ATTEMPT', resourceId: item.id, plannedAction: 'ARCHIVE' as const })),
      ...consents.map((item) => ({ resourceType: 'CONSENT', resourceId: item.id, plannedAction: 'ARCHIVE' as const })),
      ...sessions.map((item) => ({ resourceType: 'SESSION', resourceId: item.id, plannedAction: 'REVOKE' as const })),
      ...auditEvents.map((item) => ({ resourceType: 'AUDIT', resourceId: item.id, plannedAction: 'PURGE_REVIEW' as const })),
    ];
  }

  private async planAttemptDeletion(organizationId: string, attemptId: string) {
    const attempt = await (this.prisma as any).examAttempt.findFirst({ where: { id: attemptId, organizationId } });
    if (!attempt) return [];

    const [answers, logs, consents, auditEvents] = await Promise.all([
      (this.prisma as any).answerSubmission.findMany({ where: { examAttemptId: attemptId }, select: { id: true } }),
      (this.prisma as any).attemptLog.findMany({ where: { examAttemptId: attemptId }, select: { id: true } }),
      (this.prisma as any).candidateConsent.findMany({ where: { organizationId, attemptId }, select: { id: true } }),
      (this.prisma as any).auditEvent.findMany({ where: { organizationId, resourceId: attemptId }, select: { id: true } }),
    ]);

    return [
      { resourceType: 'ATTEMPT', resourceId: attemptId, plannedAction: 'ARCHIVE' as const },
      ...answers.map((item) => ({ resourceType: 'ANSWER', resourceId: item.id, plannedAction: 'ARCHIVE' as const })),
      ...logs.map((item) => ({ resourceType: 'PROCTORING_EVENT', resourceId: item.id, plannedAction: 'ARCHIVE' as const })),
      ...consents.map((item) => ({ resourceType: 'CONSENT', resourceId: item.id, plannedAction: 'ARCHIVE' as const })),
      ...auditEvents.map((item) => ({ resourceType: 'AUDIT', resourceId: item.id, plannedAction: 'PURGE_REVIEW' as const })),
    ];
  }

  private async planOrganizationDeletion(organizationId: string, subjectId: string) {
    if (organizationId !== subjectId) return [];
    const organization = await (this.prisma as any).organization.findFirst({ where: { id: organizationId } });
    if (!organization) return [];

    return [
      { resourceType: 'ORGANIZATION', resourceId: organizationId, plannedAction: 'SOFT_DELETE' as const },
      { resourceType: 'AUDIT', resourceId: organizationId, plannedAction: 'PURGE_REVIEW' as const },
      { resourceType: 'SNAPSHOT', resourceId: organizationId, plannedAction: 'PURGE_REVIEW' as const },
    ];
  }

  private async planSessionDeletion(organizationId: string, sessionId: string) {
    const session = await (this.prisma as any).userSession.findFirst({ where: { id: sessionId, organizationId } });
    return session ? [{ resourceType: 'SESSION', resourceId: sessionId, plannedAction: 'REVOKE' as const }] : [];
  }

  private async planConsentDeletion(organizationId: string, consentId: string) {
    const consent = await (this.prisma as any).candidateConsent.findFirst({ where: { id: consentId, organizationId } });
    return consent ? [{ resourceType: 'CONSENT', resourceId: consentId, plannedAction: 'ARCHIVE' as const }] : [];
  }

  private async planAuditDeletion(organizationId: string, auditId: string) {
    const auditEvent = await (this.prisma as any).auditEvent.findFirst({ where: { id: auditId, organizationId } });
    return auditEvent ? [{ resourceType: 'AUDIT', resourceId: auditId, plannedAction: 'PURGE_REVIEW' as const }] : [];
  }

  private async planProctoringDeletion(organizationId: string, resourceId: string) {
    const attempt = await (this.prisma as any).examAttempt.findFirst({
      where: { organizationId, id: resourceId },
      select: { id: true },
    });
    if (!attempt) return [];
    return [{ resourceType: 'PROCTORING_EVENT', resourceId, plannedAction: 'ARCHIVE' as const }];
  }
}
