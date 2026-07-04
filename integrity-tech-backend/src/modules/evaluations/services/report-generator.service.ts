import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { EvaluationBusinessRules, REPORT_GENERATOR_RULES } from './evaluation-business-rules';

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera un informe narrativo psicométrico y conductual en español para un intento de examen.
   */
  async generateNarrativeReport(attemptId: string, organizationId: string): Promise<string> {
    const attempt = await this.prisma.examAttempt.findFirst({
      where: { id: attemptId, organizationId },
      include: {
        resultadosTest: true,
      },
    });

    if (!attempt) {
      throw new NotFoundException('Reporte narrativo no disponible.');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: attempt.userId, organizationId },
    });

    const resultados = attempt.resultadosTest;
    const name = user ? `${user.firstName} ${user.lastName}`.trim() : 'Candidato';
    const email = user ? user.email : 'N/D';
    const dateStr = attempt.createdAt.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let reportMarkdown = `# Reporte Psicométrico y Conductual
**Evaluado:** ${name} (${email})  
**Fecha de Aplicación:** ${dateStr}  
**Índice Global de Adecuación (IGA):** **${attempt.score ? Number(attempt.score).toFixed(1) : 'N/D'}%**

---

`;

    // 1. Verificar si hay alertas de Person-Fit (inconsistencias o respuestas aleatorias)
    const hasAberrant = resultados.some(r => r.aberrante);
    if (hasAberrant) {
      const worstFit = resultados.find(r => r.aberrante);
      reportMarkdown += `> [!WARNING]
> **Alerta de Ajuste de Persona (Person-Fit):**
> Se ha detectado un patrón de respuesta inconsistente en la sección **${this.mapTestId(worstFit.testId)}** (índice lz = ${worstFit.personFitLz?.toFixed(2) || '0.00'}). Esto puede indicar falta de atención, fatiga, respuestas aleatorias o un intento extremo de falseamiento de imagen (deseabilidad social). Se recomienda interpretar este reporte con cautela y contrastar con entrevista estructurada.

`;
    }

    // Alertas de Engagement (Response Time modeling)
    for (const r of resultados) {
      if (r.engagement !== null && r.engagement !== undefined) {
        const eng = Number(r.engagement);
        if (eng < REPORT_GENERATOR_RULES.lowEngagementThreshold) {
          reportMarkdown += `> [!WARNING]
> **Alerta de Bajo Compromiso (Engagement) en ${this.mapTestId(r.testId)}:**
> El candidato mostró un bajo nivel de compromiso (${(eng * 100).toFixed(0)}% de los ítems respondidos con esfuerzo). Una proporción significativa de reactivos fue contestada con adivinación rápida (rapid guessing). Los resultados deben interpretarse con suma cautela.

`;
        } else if (eng >= REPORT_GENERATOR_RULES.highEngagementThreshold) {
          reportMarkdown += `> [!NOTE]
> **Nivel de Atención Fiel en ${this.mapTestId(r.testId)}:**
> El candidato mantuvo un alto nivel de atención y esfuerzo sostenido durante toda la prueba (${(eng * 100).toFixed(0)}% de reactivos respondidos con esfuerzo genuino).

`;
        }
      }
    }

    reportMarkdown += `## Resumen Ejecutivo de Competencias\n`;

    // 2. Generar descripción detallada para cada resultado de test
    for (const r of resultados) {
      const scaleName = this.mapTestId(r.testId);
      if (r.theta === null || r.theta === undefined) {
        reportMarkdown += `### Sección: ${scaleName}\n`;
        reportMarkdown += `* **Resultado:** No disponible por falta de theta real calculada.\n\n`;
        continue;
      }

      const theta = Number(r.theta);
      const percentile = r.percentil !== null && r.percentil !== undefined ? Number(r.percentil).toFixed(0) : 'N/D';
      
      const interpretableScale = EvaluationBusinessRules.narrativeCategoryForTheta(theta);

      reportMarkdown += `### Sección: ${scaleName}\n`;
      reportMarkdown += `* **Nivel de Habilidad Latente ($\theta$):** \`${theta.toFixed(2)}\` (Escala estándar: T-score: \`${r.thetaT?.toFixed(1) || 'N/D'}\`, CI: \`${r.thetaCi?.toFixed(1) || 'N/D'}\`)\n`;
      reportMarkdown += `* **Percentil Poblacional:** **${percentile}** (Comparación baremo dinámico)\n`;
      reportMarkdown += `* **Categoría de Competencia:** **${interpretableScale}**\n\n`;

      reportMarkdown += `${this.getNarrativeParagraph(r.testId, theta)}\n\n`;
    }

    if (attempt.score === null || attempt.score === undefined) {
      throw new BadRequestException('No existe IGA real para generar recomendación final narrativa.');
    }

    // 3. Recomendación de contratación/desarrollo final basado en el IGA
    const IGA = Number(attempt.score);
    reportMarkdown += `## Recomendación Final de Selección\n`;
    reportMarkdown += EvaluationBusinessRules.finalNarrativeRecommendation(IGA);

    return reportMarkdown;
  }

  private mapTestId(testId: string): string {
    return EvaluationBusinessRules.testScaleName(testId);
  }

  private getNarrativeParagraph(testId: string, theta: number): string {
    return EvaluationBusinessRules.narrativeParagraph(testId, theta);
  }
}
