import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../audit/services/audit.service';
import { DataExportRequest } from '../data-governance.types';

@Injectable()
export class DataExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createStructuredExport(request: DataExportRequest) {
    const job = await (this.prisma as any).dataExportJob.create({
      data: {
        organizationId: request.organizationId,
        requestedByUserId: request.requestedByUserId,
        subjectType: request.subjectType,
        subjectId: request.subjectId,
        reason: request.reason,
        status: 'RUNNING',
        format: 'JSON',
      },
    });

    try {
      const payload = await this.buildPayload(request);
      const manifest = {
        generatedAt: new Date().toISOString(),
        subjectType: request.subjectType,
        subjectId: request.subjectId,
        sections: Object.keys(payload),
      };

      const completed = await (this.prisma as any).dataExportJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          manifest,
          exportedPayload: payload,
          completedAt: new Date(),
        },
      });

      await this.audit.record({
        organizationId: request.organizationId,
        actorUserId: request.requestedByUserId,
        actorType: 'STAFF',
        action: 'data.export.completed',
        resourceType: request.subjectType,
        resourceId: request.subjectId,
        metadata: { jobId: job.id, sections: manifest.sections },
      });

      return completed;
    } catch (error) {
      await (this.prisma as any).dataExportJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async buildPayload(request: DataExportRequest): Promise<Record<string, unknown>> {
    switch (request.subjectType) {
      case 'CANDIDATE':
        return this.exportCandidate(request.organizationId, request.subjectId);
      case 'ATTEMPT':
        return this.exportAttempt(request.organizationId, request.subjectId);
      case 'REPORT':
        return this.exportReport(request.organizationId, request.subjectId);
      case 'AUDIT':
        return this.exportAuditResource(request.organizationId, request.subjectId);
      default:
        throw new NotFoundException('Tipo de exportación no soportado');
    }
  }

  private async exportCandidate(organizationId: string, userId: string) {
    const candidate = await (this.prisma as any).user.findFirst({
      where: { id: userId, organizationId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        pais: true,
        sector: true,
        nivelEducativo: true,
        tipoPuesto: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!candidate) {
      throw new NotFoundException('Candidato no disponible');
    }

    const [attempts, consents, sessions, auditEvents] = await Promise.all([
      (this.prisma as any).examAttempt.findMany({
        where: { organizationId, userId },
        include: { submissions: true, logs: true, resultadosTest: true, resultadoGlobal: true },
      }),
      (this.prisma as any).candidateConsent.findMany({ where: { organizationId, userId } }),
      (this.prisma as any).userSession.findMany({
        where: { organizationId, userId },
        select: {
          id: true,
          organizationId: true,
          userId: true,
          userAgent: true,
          ipAddress: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
          lastUsedAt: true,
        },
      }),
      (this.prisma as any).auditEvent.findMany({
        where: { organizationId, actorUserId: userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { candidate, attempts, consents, sessions, auditEvents };
  }

  private async exportAttempt(organizationId: string, attemptId: string) {
    const attempt = await (this.prisma as any).examAttempt.findFirst({
      where: { id: attemptId, organizationId },
      include: {
        submissions: true,
        logs: true,
        candidateConsent: true,
        resultadosTest: true,
        resultadoGlobal: true,
      },
    });
    if (!attempt) {
      throw new NotFoundException('Intento no disponible');
    }

    const auditEvents = await (this.prisma as any).auditEvent.findMany({
      where: { organizationId, resourceId: attemptId },
      orderBy: { createdAt: 'desc' },
    });

    return { attempt, auditEvents };
  }

  private async exportReport(organizationId: string, attemptId: string) {
    const attempt = await (this.prisma as any).examAttempt.findFirst({
      where: { id: attemptId, organizationId },
      select: {
        id: true,
        organizationId: true,
        userId: true,
        status: true,
        score: true,
        scoreDetails: true,
        submittedAt: true,
        resultadoGlobal: true,
        resultadosTest: true,
      },
    });
    if (!attempt) {
      throw new NotFoundException('Reporte no disponible');
    }

    const auditEvents = await (this.prisma as any).auditEvent.findMany({
      where: { organizationId, resourceType: 'REPORT', resourceId: attemptId },
      orderBy: { createdAt: 'desc' },
    });

    return { report: attempt, auditEvents };
  }

  private async exportAuditResource(organizationId: string, resourceId: string) {
    const auditEvents = await (this.prisma as any).auditEvent.findMany({
      where: { organizationId, resourceId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    return { auditEvents };
  }
}
