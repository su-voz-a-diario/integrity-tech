import { Injectable, Logger } from '@nestjs/common';
import { AttemptRepository } from '../repositories/attempt.repository';

@Injectable()
export class AttemptService {
  private readonly logger = new Logger(AttemptService.name);

  constructor(private readonly attempts: AttemptRepository) {}

  async listAttempts(organizationId: string) {
    this.logger.log('Listando todos los intentos de evaluación finalizados...');
    const attempts = await this.attempts.listAttemptsForTenant(organizationId);

    const result = [];
    for (const att of attempts) {
      const user = await this.attempts.findUserInTenant(att.userId, organizationId);
      const exam = await this.attempts.findExamInTenant(att.examId, organizationId);
      const logs = att.logs || [];
      const hasCritical = logs.some((log) => log.riskLevel === 'CRITICAL');
      const hasWarning = logs.some((log) => log.riskLevel === 'WARNING');
      const riskStatus = hasCritical ? 'CRITICAL' : hasWarning ? 'WARNING' : 'SAFE';
      const statusLabel = riskStatus === 'CRITICAL' ? 'Fraude probable' : riskStatus === 'WARNING' ? 'Sospechoso' : 'Sin alertas';

      result.push({
        id: att.id,
        candidateName: user ? `${user.firstName} ${user.lastName}`.trim() : 'Candidato Externo',
        email: user?.email || 'unknown@example.com',
        assessmentTitle: exam?.title || 'Evaluación Psicométrica',
        date: att.submittedAt ? att.submittedAt.toLocaleString() : att.startedAt.toLocaleString(),
        overallScore: att.score ? `${att.score}/100` : 'Pendiente',
        incidentsCount: logs.length,
        riskStatus,
        statusLabel,
      });
    }

    return result;
  }
}
