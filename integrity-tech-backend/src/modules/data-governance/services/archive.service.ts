import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../audit/services/audit.service';
import { DATA_CLASSIFICATION_REGISTRY } from '../data-classification.registry';
import { DataLifecycleState, DataSubjectType } from '../data-governance.types';

@Injectable()
export class ArchiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async registerActiveResource(input: {
    organizationId: string;
    resourceType: DataSubjectType;
    resourceId: string;
    actorUserId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const classification = DATA_CLASSIFICATION_REGISTRY[input.resourceType];

    const record = await (this.prisma as any).dataLifecycleRecord.upsert({
      where: {
        organizationId_resourceType_resourceId: {
          organizationId: input.organizationId,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
        },
      },
      update: {
        classification,
        state: 'ACTIVE',
        metadata: input.metadata || undefined,
        lastReviewedAt: new Date(),
      },
      create: {
        organizationId: input.organizationId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        classification,
        state: 'ACTIVE',
        metadata: input.metadata || undefined,
      },
    });

    await this.audit.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      actorType: input.actorUserId ? 'STAFF' : 'SYSTEM',
      action: 'data.lifecycle.registered',
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: { state: 'ACTIVE', classification },
    });

    return record;
  }

  async markArchived(input: {
    organizationId: string;
    resourceType: DataSubjectType;
    resourceId: string;
    actorUserId?: string;
    reason: string;
  }) {
    return this.transition(input, 'ARCHIVED', { archivedAt: new Date() });
  }

  async markDeleted(input: {
    organizationId: string;
    resourceType: DataSubjectType;
    resourceId: string;
    actorUserId?: string;
    reason: string;
  }) {
    return this.transition(input, 'DELETED', { deletedAt: new Date() });
  }

  async markPurged(input: {
    organizationId: string;
    resourceType: DataSubjectType;
    resourceId: string;
    actorUserId?: string;
    reason: string;
  }) {
    return this.transition(input, 'PURGED', { purgedAt: new Date() });
  }

  private async transition(
    input: {
      organizationId: string;
      resourceType: DataSubjectType;
      resourceId: string;
      actorUserId?: string;
      reason: string;
    },
    state: DataLifecycleState,
    timestamps: Record<string, Date>,
  ) {
    const record = await (this.prisma as any).dataLifecycleRecord.update({
      where: {
        organizationId_resourceType_resourceId: {
          organizationId: input.organizationId,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
        },
      },
      data: {
        state,
        ...timestamps,
        metadata: {
          reason: input.reason,
          transitionedAt: new Date().toISOString(),
        },
      },
    });

    await this.audit.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      actorType: input.actorUserId ? 'STAFF' : 'SYSTEM',
      action: `data.lifecycle.${state.toLowerCase()}`,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: { reason: input.reason },
    });

    return record;
  }
}
