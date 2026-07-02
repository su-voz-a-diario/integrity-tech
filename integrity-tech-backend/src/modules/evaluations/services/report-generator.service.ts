import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera un informe narrativo psicométrico y conductual en español para un intento de examen.
   */
  async generateNarrativeReport(attemptId: string): Promise<string> {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        resultadosTest: true,
      },
    });

    if (!attempt) {
      throw new NotFoundException(`No se encontró el intento de examen con ID: ${attemptId}`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: attempt.userId },
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
> Se ha detectado un patrón de respuesta inconsistente en la sección **${this.mapTestId(worstFit.testId)}** (índice lz = ${worstFit.personFitLz.toFixed(2)}). Esto puede indicar falta de atención, fatiga, respuestas aleatorias o un intento extremo de falseamiento de imagen (deseabilidad social). Se recomienda interpretar este reporte con cautela y contrastar con entrevista estructurada.

`;
    }

    reportMarkdown += `## Resumen Ejecutivo de Competencias\n`;

    // 2. Generar descripción detallada para cada resultado de test
    for (const r of resultados) {
      const scaleName = this.mapTestId(r.testId);
      const theta = r.theta ?? 0.0;
      const percentile = r.percentil ? Number(r.percentil).toFixed(0) : 'N/D';
      
      let interpretableScale = '';
      if (theta < -1.5) interpretableScale = 'Básico / Crítico';
      else if (theta < 0.5) interpretableScale = 'En desarrollo';
      else if (theta < 1.5) interpretableScale = 'Competente';
      else interpretableScale = 'Sobresaliente / Experto';

      reportMarkdown += `### Sección: ${scaleName}\n`;
      reportMarkdown += `* **Nivel de Habilidad Latente ($\\theta$):** \`${theta.toFixed(2)}\` (Escala estándar: T-score: \`${r.thetaT?.toFixed(1) || 'N/D'}\`, CI: \`${r.thetaCi?.toFixed(1) || 'N/D'}\`)\n`;
      reportMarkdown += `* **Percentil Poblacional:** **${percentile}%** (Comparación baremo dinámico)\n`;
      reportMarkdown += `* **Categoría de Competencia:** **${interpretableScale}**\n\n`;

      // Narrativa de acuerdo a las reglas psicométricas
      reportMarkdown += `${this.getNarrativeParagraph(r.testId, theta)}\n\n`;
    }

    // 3. Recomendación de contratación/desarrollo final basado en el IGA
    const IGA = Number(attempt.score ?? 50.0);
    reportMarkdown += `## Recomendación Final de Selección\n`;
    if (IGA >= 80.0) {
      reportMarkdown += `El perfil del candidato demuestra una compatibilidad **altamente sobresaliente** con las exigencias del puesto. Sus habilidades cognitivas combinadas con su nivel de integridad denotan un alto potencial de desempeño y un riesgo conductual extremadamente bajo. **Recomendación: Altamente Apto.**`;
    } else if (IGA >= 60.0) {
      reportMarkdown += `El candidato cumple de manera sólida con el estándar del perfil. Muestra niveles estables de integridad y competencia, con pequeños márgenes de mejora en áreas particulares. **Recomendación: Apto con reservas de onboarding.**`;
    } else {
      reportMarkdown += `El candidato se encuentra por debajo del perfil conductual idóneo establecido para el puesto. Su nivel general de adecuación indica posibles dificultades de adaptación o áreas de riesgo que requieren mayor escrutinio. **Recomendación: No apto para perfiles críticos.**`;
    }

    return reportMarkdown;
  }

  private mapTestId(testId: string): string {
    const names = {
      'IT2_I': 'Integridad y Valores',
      'IT2_P10': 'Personalidad Organizacional',
      'IT2_AC10': 'Habilidad Cognitiva General',
      'IT2_CB10': 'Competencias de Liderazgo',
    };
    return names[testId] || testId;
  }

  private getNarrativeParagraph(testId: string, theta: number): string {
    if (testId === 'IT2_I') {
      if (theta < -1.5) {
        return 'El evaluado demuestra una baja adhesión a las normas y principios éticos institucionales. Podría tender a racionalizar comportamientos de riesgo y priorizar intereses individuales sobre las políticas de cumplimiento de la empresa.';
      } else if (theta < 0.5) {
        return 'Muestra una adhesión a valores éticos en rango promedio. Se comporta de acuerdo a las normas cuando el entorno es claro y supervisado, pero puede exhibir vulnerabilidades ante presiones situacionales fuertes.';
      } else if (theta < 1.5) {
        return 'Manifiesta una sólida y consistente orientación ética. Se apega fielmente a los códigos de conducta corporativos, valora la transparencia en la comunicación y toma decisiones velando por el cumplimiento ético.';
      } else {
        return 'Excepcional orientación hacia la honestidad e integridad moral. Actúa activamente como promotor de los valores corporativos y demuestra un compromiso férreo contra las conductas inapropiadas o corruptas.';
      }
    }

    if (testId === 'IT2_P10') {
      if (theta < -1.5) {
        return 'Registra niveles bajos de estabilidad y organización. Suele reaccionar de forma impulsiva a las demandas laborales imprevistas y puede tener dificultades de colaboración constructiva en equipos de trabajo.';
      } else if (theta < 0.5) {
        return 'Demuestra una adaptabilidad emocional aceptable. Trabaja bien bajo supervisión regular y posee características de extroversión y responsabilidad adecuadas para tareas con niveles normales de presión.';
      } else if (theta < 1.5) {
        return 'Posee un excelente perfil de autorregulación y madurez profesional. Muestra resiliencia ante el estrés, es perseverante, estructurado en sus actividades y demuestra una alta orientación a la calidad de su trabajo.';
      } else {
        return 'Sobresaliente proactividad y liderazgo adaptativo. Altamente colaborativo, estratega e inspirador para los demás, con una tolerancia al fracaso sobresaliente que le permite manejar la incertidumbre con calma.';
      }
    }

    if (testId === 'IT2_AC10') {
      if (theta < -1.5) {
        return 'Presenta tiempos de aprendizaje más prolongados de lo habitual. Requiere guías claras, estructuradas paso a paso y supervisión cercana para consolidar nuevos conocimientos conceptuales.';
      } else if (theta < 0.5) {
        return 'Posee una capacidad razonamiento general en el promedio de la población laboral. Resuelve problemas cotidianos con efectividad y puede asimilar instrucciones operativas de mediana complejidad.';
      } else if (theta < 1.5) {
        return 'Muestra agilidad mental y un excelente potencial de aprendizaje. Capta y procesa información compleja de manera rápida, estructurando soluciones lógicas a problemas abstractos de forma autónoma.';
      } else {
        return 'Extraordinaria aptitud cognitiva y analítica. Domina tareas de muy alta complejidad técnica y estratégica, asimilando conceptos avanzados con el mínimo entrenamiento previo y destacando por su visión innovadora.';
      }
    }

    // Default or Competencies (IT2_CB10)
    if (theta < -1.5) {
      return 'Muestra escasa iniciativa para orientar a otros. Prefiere realizar tareas de forma individual y no demuestra competencias clave asociadas a la delegación de responsabilidades o coaching.';
    } else if (theta < 0.5) {
      return 'Demuestra habilidades básicas de liderazgo técnico. Logra coordinar actividades rutinarias, pero le falta afianzar la comunicación de visiones compartidas o el empoderamiento de su equipo.';
    } else if (theta < 1.5) {
      return 'Lidera equipos de forma asertiva y motivadora. Sabe delegar, promueve el crecimiento continuo de sus colaboradores directos y se orienta firmemente a la consecución de resultados grupales.';
    } else {
      return 'Liderazgo visionario e inspirador de alto impacto. Transforma organizaciones mediante la articulación de estrategias claras, el fomento de culturas innovadoras y el desarrollo del talento a niveles del más alto estándar.';
    }
  }
}
