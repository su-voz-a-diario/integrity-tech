import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../audit/services/audit.service';
import { CriticalAssetType } from '../data-governance.types';

@Injectable()
export class CriticalAssetVersionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createVersion(input: {
    organizationId: string;
    assetType: CriticalAssetType;
    assetKey: string;
    version: string;
    payload: Record<string, unknown>;
    createdByUserId?: string;
    effectiveFrom?: Date;
  }) {
    const contentHash = this.hashPayload(input.payload);
    const version = await (this.prisma as any).criticalAssetVersion.create({
      data: {
        organizationId: input.organizationId,
        assetType: input.assetType,
        assetKey: input.assetKey,
        version: input.version,
        payload: input.payload,
        contentHash,
        effectiveFrom: input.effectiveFrom,
        createdByUserId: input.createdByUserId || null,
        status: 'DRAFT',
      },
    });

    await this.audit.record({
      organizationId: input.organizationId,
      actorUserId: input.createdByUserId,
      actorType: input.createdByUserId ? 'STAFF' : 'SYSTEM',
      action: 'data.asset_version.created',
      resourceType: input.assetType,
      resourceId: input.assetKey,
      metadata: { version: input.version, contentHash },
    });

    return version;
  }

  async approveVersion(input: {
    organizationId: string;
    assetVersionId: string;
    approvedByUserId: string;
    effectiveFrom?: Date;
  }) {
    const version = await (this.prisma as any).criticalAssetVersion.findFirst({
      where: { id: input.assetVersionId, organizationId: input.organizationId },
    });
    if (!version) {
      return null;
    }

    const approved = await (this.prisma as any).criticalAssetVersion.update({
      where: { id: input.assetVersionId },
      data: {
        status: 'APPROVED',
        approvedByUserId: input.approvedByUserId,
        approvedAt: new Date(),
        effectiveFrom: input.effectiveFrom || version.effectiveFrom || new Date(),
      },
    });

    await this.audit.record({
      organizationId: input.organizationId,
      actorUserId: input.approvedByUserId,
      actorType: 'STAFF',
      action: 'data.asset_version.approved',
      resourceType: version.assetType,
      resourceId: version.assetKey,
      metadata: { version: version.version, assetVersionId: input.assetVersionId },
    });

    return approved;
  }

  private hashPayload(payload: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}
