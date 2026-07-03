import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../audit/services/audit.service';
import { DEFAULT_RETENTION_POLICIES } from '../data-classification.registry';
import { DataSubjectType, RetentionPolicyConfig } from '../data-governance.types';

@Injectable()
export class RetentionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  defaultPolicies(): RetentionPolicyConfig[] {
    return DEFAULT_RETENTION_POLICIES;
  }

  async ensureDefaultPolicies(organizationId: string, actorUserId?: string) {
    const policies = await Promise.all(
      DEFAULT_RETENTION_POLICIES.map((policy) =>
        (this.prisma as any).retentionPolicy.upsert({
          where: {
            organizationId_dataType: {
              organizationId,
              dataType: policy.dataType,
            },
          },
          update: {
            classification: policy.classification,
            activeDays: policy.activeDays,
            archiveAfterDays: policy.archiveAfterDays,
            deleteAfterDays: policy.deleteAfterDays,
            purgeAfterDays: policy.purgeAfterDays,
            legalHoldAllowed: policy.legalHoldAllowed,
            description: policy.description,
            isDefault: true,
          },
          create: {
            organizationId,
            dataType: policy.dataType,
            classification: policy.classification,
            activeDays: policy.activeDays,
            archiveAfterDays: policy.archiveAfterDays,
            deleteAfterDays: policy.deleteAfterDays,
            purgeAfterDays: policy.purgeAfterDays,
            legalHoldAllowed: policy.legalHoldAllowed,
            description: policy.description,
            isDefault: true,
            createdByUserId: actorUserId || null,
          },
        }),
      ),
    );

    await this.audit.record({
      organizationId,
      actorUserId,
      actorType: actorUserId ? 'STAFF' : 'SYSTEM',
      action: 'data.retention.defaults_ensured',
      resourceType: 'RETENTION_POLICY',
      metadata: { policyCount: policies.length },
    });

    return policies;
  }

  getPolicy(organizationId: string, dataType: DataSubjectType) {
    return (this.prisma as any).retentionPolicy.findUnique({
      where: {
        organizationId_dataType: {
          organizationId,
          dataType,
        },
      },
    });
  }

  async evaluateLifecycleCandidates(organizationId: string, asOf: Date = new Date()) {
    const policies = await (this.prisma as any).retentionPolicy.findMany({
      where: { organizationId },
    });

    return Promise.all(
      policies.map(async (policy) => {
        const archiveBefore = this.minusDays(asOf, policy.archiveAfterDays);
        const deleteBefore = this.minusDays(asOf, policy.deleteAfterDays);
        const purgeBefore = this.minusDays(asOf, policy.purgeAfterDays);

        const [archiveCandidates, deleteCandidates, purgeCandidates] = await Promise.all([
          (this.prisma as any).dataLifecycleRecord.count({
            where: {
              organizationId,
              resourceType: policy.dataType,
              state: 'ACTIVE',
              activeAt: { lte: archiveBefore },
              legalHoldUntil: null,
            },
          }),
          (this.prisma as any).dataLifecycleRecord.count({
            where: {
              organizationId,
              resourceType: policy.dataType,
              state: 'ARCHIVED',
              archivedAt: { lte: deleteBefore },
              legalHoldUntil: null,
            },
          }),
          (this.prisma as any).dataLifecycleRecord.count({
            where: {
              organizationId,
              resourceType: policy.dataType,
              state: 'DELETED',
              deletedAt: { lte: purgeBefore },
              legalHoldUntil: null,
            },
          }),
        ]);

        return {
          dataType: policy.dataType,
          classification: policy.classification,
          archiveCandidates,
          deleteCandidates,
          purgeCandidates,
        };
      }),
    );
  }

  private minusDays(date: Date, days: number): Date {
    return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
  }
}
