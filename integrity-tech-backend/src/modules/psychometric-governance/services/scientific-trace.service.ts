import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../audit/services/audit.service';
import { GovernanceTrace } from '../psychometric-governance.types';

@Injectable()
export class ScientificTraceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async buildAttemptTrace(organizationId: string, attemptId: string): Promise<GovernanceTrace> {
    const attempt = await (this.prisma as any).examAttempt.findFirst({
      where: { id: attemptId, organizationId },
      include: {
        submissions: { select: { itemVersionId: true } },
        resultadosTest: {
          select: {
            scoringModelVersionId: true,
            normGroupVersionId: true,
          },
        },
        resultadoGlobal: {
          select: {
            scoringModelVersionId: true,
            normGroupVersionId: true,
            reportTemplateVersionId: true,
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException('Intento no disponible');
    }

    const itemVersionIds: string[] = Array.from(
      new Set<string>(
        attempt.submissions
          .map((submission) => submission.itemVersionId)
          .filter((itemVersionId): itemVersionId is string => typeof itemVersionId === 'string'),
      ),
    );
    const scoringModelVersionId =
      attempt.resultadoGlobal?.scoringModelVersionId ||
      attempt.resultadosTest.find((result) => result.scoringModelVersionId)?.scoringModelVersionId ||
      null;
    const normGroupVersionId =
      attempt.resultadoGlobal?.normGroupVersionId ||
      attempt.resultadosTest.find((result) => result.normGroupVersionId)?.normGroupVersionId ||
      null;
    const reportTemplateVersionId = attempt.resultadoGlobal?.reportTemplateVersionId || null;

    return {
      mode: this.resolveMode({
        assessmentVersionId: attempt.assessmentVersionId,
        itemVersionIds,
        scoringModelVersionId,
        normGroupVersionId,
        reportTemplateVersionId,
      }),
      assessmentVersionId: attempt.assessmentVersionId,
      itemVersionIds,
      scoringModelVersionId,
      normGroupVersionId,
      reportTemplateVersionId,
      generatedAt: new Date().toISOString(),
    };
  }

  async attachTraceToResults(input: {
    organizationId: string;
    attemptId: string;
    actorUserId?: string;
  }) {
    const trace = await this.buildAttemptTrace(input.organizationId, input.attemptId);

    await (this.prisma as any).$transaction([
      (this.prisma as any).resultadoTest.updateMany({
        where: { examAttemptId: input.attemptId },
        data: { governanceTrace: trace },
      }),
      (this.prisma as any).resultadoGlobal.updateMany({
        where: { examAttemptId: input.attemptId },
        data: { governanceTrace: trace },
      }),
    ]);

    await this.audit.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      actorType: input.actorUserId ? 'STAFF' : 'SYSTEM',
      action: 'psychometric.trace.attached',
      resourceType: 'EXAM_ATTEMPT',
      resourceId: input.attemptId,
      metadata: trace,
    });

    return trace;
  }

  async recordIssuedReport(input: {
    organizationId: string;
    attemptId: string;
    reportTemplateVersionId: string;
    issuedByUserId?: string;
  }) {
    const trace = await this.buildAttemptTrace(input.organizationId, input.attemptId);
    const traceWithTemplate = {
      ...trace,
      reportTemplateVersionId: input.reportTemplateVersionId,
      generatedAt: new Date().toISOString(),
    };

    const record = await (this.prisma as any).reportIssueRecord.create({
      data: {
        organizationId: input.organizationId,
        examAttemptId: input.attemptId,
        reportTemplateVersionId: input.reportTemplateVersionId,
        issuedByUserId: input.issuedByUserId || null,
        governanceTrace: traceWithTemplate,
      },
    });

    await this.audit.record({
      organizationId: input.organizationId,
      actorUserId: input.issuedByUserId,
      actorType: input.issuedByUserId ? 'STAFF' : 'SYSTEM',
      action: 'psychometric.report.issued_traced',
      resourceType: 'REPORT',
      resourceId: input.attemptId,
      metadata: { reportIssueRecordId: record.id, trace: traceWithTemplate },
    });

    return record;
  }

  private resolveMode(trace: {
    assessmentVersionId?: string | null;
    itemVersionIds: string[];
    scoringModelVersionId?: string | null;
    normGroupVersionId?: string | null;
    reportTemplateVersionId?: string | null;
  }): 'VERSIONED' | 'PARTIAL' | 'LEGACY_UNVERSIONED' {
    const hasAssessmentAndItems = Boolean(trace.assessmentVersionId) && trace.itemVersionIds.length > 0;
    const hasResultVersions = Boolean(trace.scoringModelVersionId || trace.normGroupVersionId || trace.reportTemplateVersionId);
    if (hasAssessmentAndItems && hasResultVersions) return 'VERSIONED';
    if (hasAssessmentAndItems || hasResultVersions) return 'PARTIAL';
    return 'LEGACY_UNVERSIONED';
  }
}
