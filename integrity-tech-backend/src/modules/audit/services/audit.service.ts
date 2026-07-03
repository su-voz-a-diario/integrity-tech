import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditQueryDto } from '../dto/audit-query.dto';
import { RecordAuditEventInput } from '../audit-event.types';
import { MetricsService } from '../../../shared/observability/metrics.service';
import { OperationalEventPublisher } from '../../../shared/observability/operational-event.publisher';
import { RequestContextService } from '../../../shared/observability/request-context.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly context?: RequestContextService,
    @Optional() private readonly metrics?: MetricsService,
    @Optional() private readonly operationalEvents?: OperationalEventPublisher,
  ) {}

  async record(input: RecordAuditEventInput): Promise<void> {
    try {
      await (this.prisma as any).auditEvent.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId || null,
          actorType: input.actorType,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId || null,
          ipAddress: input.ipAddress || null,
          userAgent: input.userAgent || null,
          metadata: {
            ...(input.metadata || {}),
            traceId: this.context?.getTraceId() || null,
            requestId: this.context?.getRequestId() || null,
          },
        },
      });
      this.metrics?.recordAuditEvent(input.action, 'success');
    } catch (error) {
      this.metrics?.recordAuditEvent(input.action, 'failure');
      this.operationalEvents?.publish('AUDIT_UNAVAILABLE', { action: input.action, error: error.message });
      this.logger.warn(`No se pudo registrar evento de auditoría (${input.action}): ${error.message}`);
    }
  }

  findEvents(organizationId: string, query: AuditQueryDto) {
    return (this.prisma as any).auditEvent.findMany({
      where: {
        organizationId,
        ...(query.resourceType ? { resourceType: query.resourceType } : {}),
        ...(query.resourceId ? { resourceId: query.resourceId } : {}),
        ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
