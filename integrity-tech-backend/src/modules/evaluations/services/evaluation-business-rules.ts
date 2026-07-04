export const TEST_SCALE_NAMES: Record<string, string> = {
  IT2_I: 'Integridad y Valores',
  IT2_P10: 'Personalidad Organizacional',
  IT2_AC10: 'Habilidad Cognitiva General',
  IT2_CB10: 'Competencias de Liderazgo',
};

export const IGA_RECOMMENDATION_RULES = {
  greenThreshold: 75.0,
  yellowThreshold: 50.0,
  recommended: 'Recomendado',
  acceptableWithObservations: 'Aceptable con observaciones',
  notRecommended: 'No recomendado',
} as const;

export const IGA_ALERT_THRESHOLDS: Record<string, { threshold: number; message: string }> = {
  IT2_I: { threshold: 20.0, message: 'Riesgo ético elevado' },
  IT2_AC10: { threshold: 15.0, message: 'Capacidad cognitiva muy limitada para el puesto' },
  IT2_CB10: { threshold: 20.0, message: 'Competencias blandas insuficientes' },
};

export const REPORT_CATEGORY_RULES = {
  theta: [
    { maxExclusive: -1.5, label: 'Básico' },
    { maxExclusive: 0.5, label: 'En desarrollo' },
    { maxExclusive: 1.5, label: 'Competente' },
  ],
  thetaDefault: 'Sobresaliente',
  narrativeTheta: [
    { maxExclusive: -1.5, label: 'Básico / Crítico' },
    { maxExclusive: 0.5, label: 'En desarrollo' },
    { maxExclusive: 1.5, label: 'Competente' },
  ],
  narrativeThetaDefault: 'Sobresaliente / Experto',
  percentile: [
    { maxExclusive: 25, label: 'Básico' },
    { maxExclusive: 75, label: 'En desarrollo' },
    { maxExclusive: 90, label: 'Competente' },
  ],
  percentileDefault: 'Sobresaliente',
} as const;

export const REPORT_DIMENSION_DESCRIPTIONS: Record<string, string> = {
  INTEGRIDAD: 'Indica apego a las normas éticas y baja propensión a justificar actos deshonestos.',
  SOCIABILIDAD: 'Mide el nivel de empatía e integración del candidato en equipos de trabajo.',
  LEALTAD: 'Mide la coincidencia con los valores corporativos y la confidencialidad organizacional.',
  GENERAL: 'Puntuación analítica consolidada general del reactivo.',
};

export const DEFAULT_REPORT_DIMENSION_DESCRIPTION = 'Dimensión psicométrica de perfil conductual.';

export const REPORT_LOG_MESSAGES: Record<string, string> = {
  tab_focus_lost: 'Pérdida de foco: Estudiante sale de la ventana del examen (cambio de pestaña/app).',
  tab_focus_gained: 'Foco restablecido: El estudiante regresa a la interfaz de toma del reactivo.',
  student_idle: 'Inactividad prolongada detectada en el cliente.',
  suspicious_behavior_detected: 'COMPORTAMIENTO SOSPECHOSO: Alerta por excesiva pérdida de foco.',
  identity_snapshot: 'CAPTURA DE IDENTIDAD: Captura periódica por webcam registrada.',
};

export const DEFAULT_REPORT_LOG_MESSAGE = 'Evento de telemetría de sesión registrado.';

export const REPORT_GENERATOR_RULES = {
  lowEngagementThreshold: 0.8,
  highEngagementThreshold: 0.95,
  finalRecommendation: [
    {
      minInclusive: 80.0,
      text: 'El perfil del candidato demuestra una compatibilidad **altamente sobresaliente** con las exigencias del puesto. Sus habilidades cognitivas combinadas con su nivel de integridad denotan un alto potencial de desempeño y un riesgo conductual extremadamente bajo. **Recomendación: Altamente Apto.**',
    },
    {
      minInclusive: 60.0,
      text: 'El candidato cumple de manera sólida con el estándar del perfil. Muestra niveles estables de integridad y competencia, con pequeños márgenes de mejora en áreas particulares. **Recomendación: Apto con reservas de onboarding.**',
    },
  ],
  defaultFinalRecommendation:
    'El candidato se encuentra por debajo del perfil conductual idóneo establecido para el puesto. Su nivel general de adecuación indica posibles dificultades de adaptación o áreas de riesgo que requieren mayor escrutinio. **Recomendación: No apto para perfiles críticos.**',
} as const;

export const REPORT_NARRATIVES: Record<string, Array<{ maxExclusive?: number; text: string }>> = {
  IT2_I: [
    {
      maxExclusive: -1.5,
      text: 'El evaluado demuestra una baja adhesión a las normas y principios éticos institucionales. Podría tender a racionalizar comportamientos de riesgo y priorizar intereses individuales sobre las políticas de cumplimiento de la empresa.',
    },
    {
      maxExclusive: 0.5,
      text: 'Muestra una adhesión a valores éticos en rango promedio. Se comporta de acuerdo a las normas cuando el entorno es claro y supervisado, pero puede exhibir vulnerabilidades ante presiones situacionales fuertes.',
    },
    {
      maxExclusive: 1.5,
      text: 'Manifiesta una sólida y consistente orientación ética. Se apega fielmente a los códigos de conducta corporativos, valora la transparencia en la comunicación y toma decisiones velando por el cumplimiento ético.',
    },
    {
      text: 'Excepcional orientación hacia la honestidad e integridad moral. Actúa activamente como promotor de los valores corporativos y demuestra un compromiso férreo contra las conductas inapropiadas o corruptas.',
    },
  ],
  IT2_P10: [
    {
      maxExclusive: -1.5,
      text: 'Registra niveles bajos de estabilidad y organización. Suele reaccionar de forma impulsiva a las demandas laborales imprevistas y puede tener dificultades de colaboración constructiva en equipos de trabajo.',
    },
    {
      maxExclusive: 0.5,
      text: 'Demuestra una adaptabilidad emocional aceptable. Trabaja bien bajo supervisión regular y posee características de extroversión y responsabilidad adecuadas para tareas con niveles normales de presión.',
    },
    {
      maxExclusive: 1.5,
      text: 'Posee un excelente perfil de autorregulación y madurez profesional. Muestra resiliencia ante el estrés, es perseverante, estructurado en sus actividades y demuestra una alta orientación a la calidad de su trabajo.',
    },
    {
      text: 'Sobresaliente proactividad y liderazgo adaptativo. Altamente colaborativo, estratega e inspirador para los demás, con una tolerancia al fracaso sobresaliente que le permite manejar la incertidumbre con calma.',
    },
  ],
  IT2_AC10: [
    {
      maxExclusive: -1.5,
      text: 'Presenta tiempos de aprendizaje más prolongados de lo habitual. Requiere guías claras, estructuradas paso a paso y supervisión cercana para consolidar nuevos conocimientos conceptuales.',
    },
    {
      maxExclusive: 0.5,
      text: 'Posee una capacidad razonamiento general en el promedio de la población laboral. Resuelve problemas cotidianos con efectividad y puede asimilar instrucciones operativas de mediana complejidad.',
    },
    {
      maxExclusive: 1.5,
      text: 'Muestra agilidad mental y un excelente potencial de aprendizaje. Capta y procesa información compleja de manera rápida, estructurando soluciones lógicas a problemas abstractos de forma autónoma.',
    },
    {
      text: 'Extraordinaria aptitud cognitiva y analítica. Domina tareas de muy alta complejidad técnica y estratégica, asimilando conceptos avanzados con el mínimo entrenamiento previo y destacando por su visión innovadora.',
    },
  ],
  IT2_CB10: [
    {
      maxExclusive: -1.5,
      text: 'Muestra escasa iniciativa para orientar a otros. Prefiere realizar tareas de forma individual y no demuestra competencias clave asociadas a la delegación de responsabilidades o coaching.',
    },
    {
      maxExclusive: 0.5,
      text: 'Demuestra habilidades básicas de liderazgo técnico. Logra coordinar actividades rutinarias, pero le falta afianzar la comunicación de visiones compartidas o el empoderamiento de su equipo.',
    },
    {
      maxExclusive: 1.5,
      text: 'Lidera equipos de forma asertiva y motivadora. Sabe delegar, promueve el crecimiento continuo de sus colaboradores directos y se orienta firmemente a la consecución de resultados grupales.',
    },
    {
      text: 'Liderazgo visionario e inspirador de alto impacto. Transforma organizaciones mediante la articulación de estrategias claras, el fomento de culturas innovadoras y el desarrollo del talento a niveles del más alto estándar.',
    },
  ],
};

export const RAPID_GUESSING_RULES = {
  defaultThresholdMs: 3000,
  recalibrationMinimumSampleSize: 5,
  recalibrationFallbackP10Ms: 1500,
  recalibrationMinimumThresholdMs: 1000,
  recalibrationMaximumThresholdMs: 10000,
  thresholds: [
    ['IT2_AC10_verbal', 3000],
    ['IT2_AC10_numerico', 2500],
    ['IT2_AC10_abstracto', 2000],
    ['IT2_I_SJT', 4000],
    ['IT2_I_Global', 2000],
    ['IT2_P10_Global', 1500],
    ['IT2_CB10_Global', 3500],
  ] as Array<[string, number]>,
} as const;

function resolveRuleLabel(
  value: number,
  rules: readonly { maxExclusive: number; label: string }[],
  defaultLabel: string,
) {
  return rules.find((rule) => value < rule.maxExclusive)?.label || defaultLabel;
}

export class EvaluationBusinessRules {
  static recommendationForIga(iga: number): string {
    if (iga >= IGA_RECOMMENDATION_RULES.greenThreshold) {
      return IGA_RECOMMENDATION_RULES.recommended;
    }
    if (iga >= IGA_RECOMMENDATION_RULES.yellowThreshold) {
      return IGA_RECOMMENDATION_RULES.acceptableWithObservations;
    }
    return IGA_RECOMMENDATION_RULES.notRecommended;
  }

  static alertForTestPercentile(testId: string, percentile: number): string | null {
    const rule = IGA_ALERT_THRESHOLDS[testId];
    if (!rule || percentile >= rule.threshold) return null;
    return rule.message;
  }

  static categoryForTheta(theta: number): string {
    return resolveRuleLabel(theta, REPORT_CATEGORY_RULES.theta, REPORT_CATEGORY_RULES.thetaDefault);
  }

  static narrativeCategoryForTheta(theta: number): string {
    return resolveRuleLabel(theta, REPORT_CATEGORY_RULES.narrativeTheta, REPORT_CATEGORY_RULES.narrativeThetaDefault);
  }

  static categoryForPercentile(percentile: number): string {
    return resolveRuleLabel(percentile, REPORT_CATEGORY_RULES.percentile, REPORT_CATEGORY_RULES.percentileDefault);
  }

  static testScaleName(testId: string): string {
    return TEST_SCALE_NAMES[testId] || testId;
  }

  static dimensionDescription(dimension: string): string {
    return REPORT_DIMENSION_DESCRIPTIONS[dimension] || DEFAULT_REPORT_DIMENSION_DESCRIPTION;
  }

  static proctoringLogMessage(eventType: string): string {
    return REPORT_LOG_MESSAGES[eventType] || DEFAULT_REPORT_LOG_MESSAGE;
  }

  static narrativeParagraph(testId: string, theta: number): string {
    const rules = REPORT_NARRATIVES[testId] || REPORT_NARRATIVES.IT2_CB10;
    return rules.find((rule) => rule.maxExclusive === undefined || theta < rule.maxExclusive)?.text || '';
  }

  static finalNarrativeRecommendation(iga: number): string {
    return (
      REPORT_GENERATOR_RULES.finalRecommendation.find((rule) => iga >= rule.minInclusive)?.text ||
      REPORT_GENERATOR_RULES.defaultFinalRecommendation
    );
  }
}
