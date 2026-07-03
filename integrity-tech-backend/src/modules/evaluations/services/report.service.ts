import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { AUDIT_ACTIONS, AuditRequestMetadata } from '../../audit/audit-event.types';
import { AuditService } from '../../audit/services/audit.service';
import { SessionUser } from '../../iam';
import { RecalcularIgaDto } from '../dto/evaluation-flow.dto';
import { ReportGenerated } from '../events/evaluation-domain.events';
import { ReportRepository } from '../repositories/report.repository';
import { IgaCalculatorService } from './iga-calculator.service';
import { ScientificTraceService } from '../../psychometric-governance/services/scientific-trace.service';
import { MetricsService } from '../../../shared/observability/metrics.service';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly reports: ReportRepository,
    private readonly igaCalculator: IgaCalculatorService,
    private readonly auditService: AuditService,
    private readonly scientificTrace: ScientificTraceService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async getAttemptReport(attemptId: string, staffUser: SessionUser, metadata: AuditRequestMetadata = {}) {
    const organizationId = staffUser.organizationId;
    this.logger.log(`Generando reporte para el intento: ${attemptId}`);

    const att = await this.reports.findReportAttempt(attemptId, organizationId);
    if (!att) {
      throw new BadRequestException('Intento de examen no encontrado.');
    }

    const candidate = await this.reports.findUserInTenant(att.userId, organizationId);
    const exam = await this.reports.findExamInTenant(att.examId, organizationId);
    const templateVersion = await this.reports.findPublishedReportTemplateVersion(
      organizationId,
      (att as any).assessmentVersionId,
    );
    const governanceTrace = templateVersion
      ? (await this.scientificTrace.recordIssuedReport({
          organizationId,
          attemptId: att.id,
          reportTemplateVersionId: templateVersion.id,
          issuedByUserId: staffUser.userId,
        })).governanceTrace
      : await this.scientificTrace.buildAttemptTrace(organizationId, att.id);

    const dimensions = [];
    if (att.scoreDetails) {
      const details = att.scoreDetails as any;
      for (const [dimName, val] of Object.entries(details)) {
        const dimVal = val as any;
        dimensions.push({
          name: dimName,
          score: dimVal.percentage || 0,
          description: this.getDimensionDescription(dimName),
        });
      }
    }

    const logsMapped = att.logs.map((log) => ({
      id: log.id,
      eventType: log.eventType,
      riskLevel: log.riskLevel,
      timestamp: log.timestamp.toLocaleTimeString(),
      metadata: log.metadata || {},
      message: this.getLogMessage(log.eventType),
    }));

    void new ReportGenerated(att.id, att.organizationId);
    await this.auditService.record({
      organizationId,
      actorUserId: staffUser.userId,
      actorType: 'STAFF',
      action: AUDIT_ACTIONS.REPORT_ACCESSED,
      resourceType: 'ExamAttempt',
      resourceId: att.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadata: {
        examId: att.examId,
        candidateUserId: att.userId,
        assessmentVersionId: (att as any).assessmentVersionId || null,
        reportTemplateVersionId: templateVersion?.id || null,
        governanceMode: (governanceTrace as any).mode,
      },
    });
    this.metrics?.recordDomainEvent('ReportGeneration', 'attempt_report', 'success');
    return {
      candidateName: candidate ? `${candidate.firstName} ${candidate.lastName}`.trim() : 'No disponible',
      email: candidate?.email || 'No disponible',
      assessmentTitle: exam?.title || 'No disponible',
      date: att.submittedAt ? att.submittedAt.toLocaleString() : att.startedAt.toLocaleString(),
      overallScore: att.score !== null && att.score !== undefined ? `${att.score}/100` : 'No disponible',
      ipAddress: att.ipAddress || 'No disponible',
      userAgent: att.userAgent || 'No disponible',
      sessionHmac: att.ltiMapping ? `lti-${att.ltiMapping.id}` : null,
      governanceTrace,
      dimensions,
      proctoringLogs: logsMapped,
    };
  }

  async getAttemptResultados(attemptId: string, organizationId: string) {
    this.logger.log(`Obteniendo resultados e IGA para el intento: ${attemptId}`);

    const attempt = await this.reports.findResultsAttempt(attemptId, organizationId);
    if (!attempt) {
      throw new BadRequestException('Intento de examen no encontrado.');
    }

    let igaResult = null;
    if (!attempt.resultadoGlobal) {
      try {
        igaResult = await this.igaCalculator.calcularIga(attemptId);
      } catch (err) {
        this.logger.warn(`Fallo al calcular IGA de forma automática: ${err.message}`);
      }
    } else {
      igaResult = {
        iga: Number(attempt.resultadoGlobal.iga),
        recomendacion: attempt.resultadoGlobal.recomendacion,
        alertas: attempt.resultadoGlobal.alertas as string[],
      };
    }

    const testResults: Record<string, any> = {};
    const dbTestResults = attempt.resultadosTest;

    for (const r of dbTestResults) {
      let categoria = 'Desconocido';
      if (r.theta !== null && r.theta !== undefined) {
        const thetaVal = Number(r.theta);
        const cut = await this.reports.findCutScore(organizationId, r.testId, thetaVal);
        if (cut) {
          categoria = cut.categoria;
        } else {
          if (thetaVal < -1.5) categoria = 'Básico';
          else if (thetaVal < 0.5) categoria = 'En desarrollo';
          else if (thetaVal < 1.5) categoria = 'Competente';
          else categoria = 'Sobresaliente';
        }
      } else if (r.percentil !== null && r.percentil !== undefined) {
        const pctVal = Number(r.percentil);
        if (pctVal < 25) categoria = 'Básico';
        else if (pctVal < 75) categoria = 'En desarrollo';
        else if (pctVal < 90) categoria = 'Competente';
        else categoria = 'Sobresaliente';
      }

      testResults[r.testId] = {
        puntaje_bruto: Number(r.puntajeBruto),
        percentil: r.percentil !== null ? Number(r.percentil) : null,
        theta: r.theta !== null ? Number(r.theta) : null,
        theta_error: r.thetaError !== null ? Number(r.thetaError) : null,
        theta_t: r.thetaT !== null ? Number(r.thetaT) : null,
        theta_ci: r.thetaCi !== null ? Number(r.thetaCi) : null,
        irt_calculated: r.irtCalculated,
        categoria,
      };
    }

    return {
      sesion_id: attemptId,
      perfil_puesto: attempt.resultadoGlobal?.perfil?.nombre || null,
      estado: attempt.status,
      resultados_por_test: testResults,
      iga: igaResult ? {
        valor: igaResult.iga,
        recomendacion: igaResult.recomendacion,
        alertas: igaResult.alertas,
      } : null,
    };
  }

  async recalcularIga(
    attemptId: string,
    user: SessionUser,
    body: RecalcularIgaDto,
    metadata: AuditRequestMetadata = {},
  ) {
    const organizationId = user.organizationId;
    this.logger.log(`Petición de recálculo de IGA para intento: ${attemptId} con perfil: ${body.perfilId}`);
    const attempt = await this.reports.findResultsAttempt(attemptId, organizationId);
    if (!attempt) throw new BadRequestException('Intento de examen no encontrado.');

    await this.igaCalculator.calcularIga(attemptId, body.perfilId);
    await this.auditService.record({
      organizationId,
      actorUserId: user.userId,
      actorType: 'STAFF',
      action: AUDIT_ACTIONS.IGA_RECALCULATED,
      resourceType: 'ExamAttempt',
      resourceId: attemptId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadata: {
        perfilId: body.perfilId,
      },
    });
    return this.getAttemptResultados(attemptId, organizationId);
  }

  getPerfiles(organizationId: string) {
    return this.reports.findPerfiles(organizationId);
  }

  private getDimensionDescription(dimName: string): string {
    const desc: Record<string, string> = {
      'INTEGRIDAD': 'Indica apego a las normas éticas y baja propensión a justificar actos deshonestos.',
      'SOCIABILIDAD': 'Mide el nivel de empatía e integración del candidato en equipos de trabajo.',
      'LEALTAD': 'Mide la coincidencia con los valores corporativos y la confidencialidad organizacional.',
      'GENERAL': 'Puntuación analítica consolidada general del reactivo.',
    };
    return desc[dimName] || 'Dimensión psicométrica de perfil conductual.';
  }

  private getLogMessage(eventType: string): string {
    const msg: Record<string, string> = {
      'tab_focus_lost': 'Pérdida de foco: Estudiante sale de la ventana del examen (cambio de pestaña/app).',
      'tab_focus_gained': 'Foco restablecido: El estudiante regresa a la interfaz de toma del reactivo.',
      'student_idle': 'Inactividad prolongada detectada en el cliente.',
      'suspicious_behavior_detected': 'COMPORTAMIENTO SOSPECHOSO: Alerta por excesiva pérdida de foco.',
      'identity_snapshot': 'CAPTURA DE IDENTIDAD: Captura periódica por webcam registrada.',
    };
    return msg[eventType] || 'Evento de telemetría de sesión registrado.';
  }
}
