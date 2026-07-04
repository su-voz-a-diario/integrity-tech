import { createHash } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../audit/services/audit.service';
import { PsychometricWorkflowService } from './psychometric-workflow.service';

@Injectable()
export class PsychometricVersioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly workflow: PsychometricWorkflowService,
  ) {}

  async createAssessmentVersion(input: {
    organizationId: string;
    assessmentId: string;
    version: string;
    title: string;
    description?: string;
    blueprintJson: Record<string, unknown>;
    createdByUserId?: string;
  }) {
    const assessment = await (this.prisma as any).assessment.findFirst({
      where: { id: input.assessmentId, organizationId: input.organizationId },
    });
    if (!assessment) throw new NotFoundException('Prueba no disponible');

    const version = await (this.prisma as any).assessmentVersion.create({
      data: {
        assessmentId: input.assessmentId,
        organizationId: input.organizationId,
        version: input.version,
        title: input.title,
        description: input.description,
        blueprintJson: input.blueprintJson,
        contentHash: this.hash(input.blueprintJson),
        createdByUserId: input.createdByUserId || null,
        status: 'DRAFT',
      },
    });

    await this.audit.record({
      organizationId: input.organizationId,
      actorUserId: input.createdByUserId,
      actorType: input.createdByUserId ? 'STAFF' : 'SYSTEM',
      action: 'psychometric.assessment_version.created',
      resourceType: 'ASSESSMENT_VERSION',
      resourceId: version.id,
      metadata: { assessmentId: input.assessmentId, version: input.version },
    });

    return version;
  }

  async createItemVersion(input: {
    organizationId: string;
    itemId: string;
    version: string;
    language?: string;
    stemJson: Record<string, unknown>;
    scoringKeyJson?: Record<string, unknown>;
    tags?: Record<string, unknown>;
    exposureRate?: number;
    difficulty?: number;
    discrimination?: number;
    expectedTimeSeconds?: number;
    createdByUserId?: string;
  }) {
    const item = await (this.prisma as any).item.findFirst({
      where: { id: input.itemId, organizationId: input.organizationId },
    });
    if (!item) throw new NotFoundException('Reactivo no disponible');

    const payload = {
      stemJson: input.stemJson,
      scoringKeyJson: input.scoringKeyJson || null,
      tags: input.tags || null,
      language: input.language || 'es',
    };

    const version = await (this.prisma as any).itemVersion.create({
      data: {
        itemId: input.itemId,
        version: input.version,
        language: input.language || 'es',
        stemJson: input.stemJson,
        scoringKeyJson: input.scoringKeyJson || undefined,
        tags: input.tags || undefined,
        exposureRate: input.exposureRate,
        difficulty: input.difficulty,
        discrimination: input.discrimination,
        expectedTimeSeconds: input.expectedTimeSeconds,
        contentHash: this.hash(payload),
        createdByUserId: input.createdByUserId || null,
        status: 'DRAFT',
      },
    });

    await this.audit.record({
      organizationId: input.organizationId,
      actorUserId: input.createdByUserId,
      actorType: input.createdByUserId ? 'STAFF' : 'SYSTEM',
      action: 'psychometric.item_version.created',
      resourceType: 'ITEM_VERSION',
      resourceId: version.id,
      metadata: { itemId: input.itemId, version: input.version },
    });

    return version;
  }

  async transitionVersion(input: {
    organizationId: string;
    model:
      | 'assessmentVersion'
      | 'itemVersion'
      | 'normGroupVersion'
      | 'scoringModelVersion'
      | 'reportTemplateVersion';
    id: string;
    toStatus: string;
    actorUserId?: string;
    reason?: string;
  }) {
    const current = await (this.prisma as any)[input.model].findFirst({
      where: this.tenantWhereForVersion(input.organizationId, input.model, input.id),
    });
    if (!current) throw new NotFoundException('Versión no disponible');

    this.workflow.assertCanTransition(current.status, input.toStatus);
    if (input.toStatus === 'PUBLISHED' && current.status !== 'APPROVED') {
      throw new BadRequestException('No se puede publicar una versión sin aprobación.');
    }
    if (input.toStatus === 'RETIRED') {
      this.workflow.assertRetireReason(input.reason);
    }
    const effectiveDate = this.workflow.publishTimestamp(input.toStatus);
    const usesPublishedAt = input.model === 'assessmentVersion' || input.model === 'itemVersion';

    const updated = await (this.prisma as any)[input.model].update({
      where: { id: input.id },
      data: {
        status: input.toStatus,
        ...(effectiveDate && usesPublishedAt ? { publishedAt: effectiveDate } : {}),
        ...(effectiveDate && !usesPublishedAt ? { effectiveFrom: effectiveDate } : {}),
        ...(input.toStatus === 'RETIRED' && usesPublishedAt ? { retiredAt: new Date() } : {}),
        ...(input.toStatus === 'RETIRED' && !usesPublishedAt ? { effectiveTo: new Date() } : {}),
        ...(input.toStatus === 'RETIRED' ? { retirementReason: input.reason.trim() } : {}),
        ...(input.toStatus === 'APPROVED' ? { approvedByUserId: input.actorUserId || null } : {}),
      },
    });

    await this.audit.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      actorType: input.actorUserId ? 'STAFF' : 'SYSTEM',
      action:
        input.toStatus === 'PUBLISHED'
          ? 'psychometric.version.published'
          : input.toStatus === 'RETIRED'
            ? 'psychometric.version.retired'
            : 'psychometric.version.transitioned',
      resourceType: input.model,
      resourceId: input.id,
      metadata: { from: current.status, to: input.toStatus, reason: input.reason || null },
    });

    return updated;
  }

  requestInternalReview(input: TransitionInput) {
    return this.transitionVersion({ ...input, toStatus: 'INTERNAL_REVIEW' });
  }

  requestPsychologistReview(input: TransitionInput) {
    return this.transitionVersion({ ...input, toStatus: 'PSYCHOLOGIST_REVIEW' });
  }

  approve(input: TransitionInput) {
    return this.transitionVersion({ ...input, toStatus: 'APPROVED' });
  }

  publish(input: TransitionInput) {
    return this.transitionVersion({ ...input, toStatus: 'PUBLISHED' });
  }

  retire(input: TransitionInput & { reason: string }) {
    return this.transitionVersion({ ...input, toStatus: 'RETIRED', reason: input.reason });
  }

  async updateDraftVersion(input: {
    organizationId: string;
    model:
      | 'assessmentVersion'
      | 'itemVersion'
      | 'normGroupVersion'
      | 'scoringModelVersion'
      | 'reportTemplateVersion';
    id: string;
    data: Record<string, unknown>;
  }) {
    const current = await this.assertVersionMutable(input.model, input.id, input.organizationId);
    return (this.prisma as any)[input.model].update({
      where: { id: current.id },
      data: input.data,
    });
  }

  async createNewVersionFromPublished(input: {
    organizationId: string;
    model:
      | 'assessmentVersion'
      | 'itemVersion'
      | 'normGroupVersion'
      | 'scoringModelVersion'
      | 'reportTemplateVersion';
    sourceVersionId: string;
    newVersion: string;
    actorUserId?: string;
    overrides?: Record<string, unknown>;
  }) {
    const source = await (this.prisma as any)[input.model].findFirst({
      where: this.tenantWhereForVersion(input.organizationId, input.model, input.sourceVersionId),
    });
    if (!source) throw new NotFoundException('Versión fuente no disponible');
    if (!['PUBLISHED', 'ACTIVE'].includes(source.status)) {
      throw new BadRequestException('Solo se puede crear una nueva versión desde una versión publicada/activa.');
    }

    const { id, status, publishedAt, retiredAt, effectiveFrom, effectiveTo, retirementReason, approvedByUserId, createdAt, updatedAt, ...copy } = source;
    const payload = {
      ...copy,
      ...input.overrides,
      version: input.newVersion,
      status: 'DRAFT',
      approvedByUserId: null,
      createdByUserId: input.actorUserId || source.createdByUserId || null,
    };

    if ('contentHash' in payload) {
      payload.contentHash = this.hash({ sourceVersionId: input.sourceVersionId, newVersion: input.newVersion, payload });
    }

    const created = await (this.prisma as any)[input.model].create({ data: payload });

    await this.audit.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      actorType: input.actorUserId ? 'STAFF' : 'SYSTEM',
      action: 'psychometric.version.created_from_published',
      resourceType: input.model,
      resourceId: created.id,
      metadata: {
        sourceVersionId: input.sourceVersionId,
        newVersion: input.newVersion,
      },
    });

    return created;
  }

  async assertVersionMutable(model: string, id: string, organizationId?: string) {
    const where = organizationId ? this.tenantWhereForVersion(organizationId, model, id) : { id };
    const current = await (this.prisma as any)[model].findFirst({ where });
    if (!current) throw new NotFoundException('Versión no disponible');
    this.workflow.assertMutable(current.status);
    return current;
  }

  private tenantWhereForVersion(organizationId: string, model: string, versionId: string) {
    if (model === 'assessmentVersion') return { id: versionId, organizationId };
    if (model === 'itemVersion') return { id: versionId, item: { organizationId } };
    if (model === 'normGroupVersion') return { id: versionId, normGroup: { organizationId } };
    if (model === 'scoringModelVersion') return { id: versionId, scoringModel: { organizationId } };
    if (model === 'reportTemplateVersion') return { id: versionId, reportTemplate: { organizationId } };
    throw new BadRequestException('Tipo de versión no soportado.');
  }

  private hash(payload: unknown): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}

type TransitionInput = {
  organizationId: string;
  model:
    | 'assessmentVersion'
    | 'itemVersion'
    | 'normGroupVersion'
    | 'scoringModelVersion'
    | 'reportTemplateVersion';
  id: string;
  actorUserId?: string;
  reason?: string;
};
