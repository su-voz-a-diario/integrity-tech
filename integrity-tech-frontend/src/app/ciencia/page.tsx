'use client';

import React from 'react';
import Link from 'next/link';

export default function CienciaPage() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-12 selection:bg-indigo-500/30 print:bg-white print:text-black">
      
      {/* HEADER DE CIENCIA (Navegación) */}
      <div className="max-w-4xl mx-auto flex justify-between items-center border-b border-slate-900 pb-6 mb-10 print:hidden">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-400 transition-colors">← Volver al Portal</span>
        </Link>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
        >
          🖨️ Imprimir / Guardar PDF
        </button>
      </div>

      <article className="max-w-4xl mx-auto flex flex-col gap-8 text-left bg-slate-900/10 border border-slate-900/50 p-6 md:p-12 rounded-3xl print:border-none print:p-0">
        
        {/* PORTADA DEL WHITE PAPER */}
        <div className="flex flex-col gap-4 border-b border-slate-900 pb-8">
          <div className="flex items-center gap-3">
            <img 
              src="/integrity-logo-2.png" 
              alt="Integrity Tech Logo" 
              className="w-12 h-12 object-contain"
            />
            <span className="text-3xs font-extrabold uppercase tracking-widest text-indigo-400">Documento Técnico Oficial</span>
          </div>
          
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight mt-2">
            Integrity Tech: Plataforma de Evaluación Psicométrica de Nueva Generación
          </h1>
          
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400 mt-2 font-mono">
            <div><strong>Versión:</strong> 1.0</div>
            <div><strong>Fecha:</strong> Julio 2026</div>
            <div><strong>Autoría:</strong> Consejo Científico de Integrity Tech</div>
          </div>
        </div>

        {/* RESUMEN EJECUTIVO */}
        <section className="bg-slate-900/40 border border-indigo-500/10 p-6 rounded-2xl relative overflow-hidden print:border-slate-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-3xl pointer-events-none"></div>
          <h2 className="text-lg font-bold text-indigo-400 mb-3 print:text-black">Resumen Ejecutivo</h2>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-light">
            Integrity Tech es una plataforma de evaluación del talento basada en los más rigurosos estándares psicométricos contemporáneos. Diseñada para entornos corporativos que exigen precisión, equidad y profundidad analítica, la plataforma integra la Teoría de Respuesta al Ítem (IRT), tests adaptativos computerizados (CAT), baremación continua con modelos GAMLSS, detección de falta de esfuerzo mediante tiempos de respuesta y un sistema completo de validación predictiva. Este documento describe la arquitectura científica y técnica que sustenta la plataforma, demostrando su capacidad para ofrecer mediciones fiables, comparables y libres de sesgo, con un retorno de inversión cuantificable para las organizaciones.
          </p>
        </section>

        {/* 1. INTRODUCCIÓN */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-white border-l-2 border-indigo-500 pl-3 print:text-black print:border-black">1. Introducción</h2>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-light">
            La selección de personal moderna enfrenta desafíos crecientes: evaluaciones remotas a gran escala, necesidad de reducir la duración de las pruebas sin perder precisión, exigencias legales de equidad y la demanda de informes accionables por parte de los líderes de negocio. La psicometría clásica, basada en puntuaciones brutas y baremos estáticos, no logra responder a estas necesidades.
          </p>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-light">
            Integrity Tech ha desarrollado un motor psicométrico de última generación que aprovecha los avances más recientes en medición psicológica, inteligencia artificial y computación distribuida. La plataforma ofrece cuatro pilares de evaluación —Integridad, Personalidad (Big Five), Aptitud Cognitiva y Competencias Blandas— y los combina en un Índice Global de Adecuación (IGA) totalmente personalizable. Este white paper detalla los fundamentos científicos, la implementación técnica y las capacidades diferenciales de la plataforma.
          </p>
        </section>

        {/* 2. MARCO TEÓRICO */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold text-white border-l-2 border-indigo-500 pl-3 print:text-black print:border-black">2. Marco Teórico y Modelos Psicométricos</h2>
          
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-indigo-400 print:text-black">2.1 Teoría de Respuesta al Ítem (IRT)</h3>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-light">
              A diferencia de la Teoría Clásica de los Tests (TCT), que asume que todos los ítems contribuyen igual a la medida, Integrity Tech emplea modelos de IRT que modelan la probabilidad de una respuesta en función del nivel de habilidad latente (θ) y de las características del ítem. Se utilizan dos modelos fundamentales:
            </p>
            <ul className="list-disc pl-5 text-xs md:text-sm text-slate-300 leading-relaxed font-light space-y-1.5">
              <li><strong>Modelo logístico de 2 parámetros (2PL):</strong> para ítems dicotómicos (e.g., test cognitivo, juicio situacional de integridad).</li>
              <li><strong>Modelo de Respuesta Graduada (GRM):</strong> de Samejima para ítems politómicos (escalas Likert de personalidad, competencias).</li>
            </ul>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-light">
              Estos modelos ofrecen invarianza de los parámetros, permitiendo comparaciones válidas entre candidatos que han respondido diferentes conjuntos de ítems, y constituyen la base tanto para el test adaptativo como para la equiparación de puntuaciones (Kolen & Brennan, 2014).
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-indigo-400 print:text-black">2.2 Tests Adaptativos Computerizados (CAT)</h3>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-light">
              El CAT selecciona en tiempo real el siguiente ítem que maximiza la información para el nivel de habilidad estimado del candidato (Máxima Información, MII). El algoritmo detiene la prueba cuando el error estándar de θ es inferior a 0.35 o se alcanza una longitud máxima de 15 ítems. Esto reduce el tiempo de evaluación en un 30-50% con respecto a una versión lineal, sin pérdida de precisión (Wainer, 2000).
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-indigo-400 print:text-black">2.3 Modelado del Esfuerzo: Effort-Moderated EAP</h3>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-light">
              Basado en el trabajo de Wise y DeMars (2006), la plataforma registra la latencia de respuesta de cada ítem y clasifica las respuestas como “esfuerzo genuino” o “adivinación rápida”. Aquellas respuestas clasificadas como adivinación se excluyen del cálculo de θ mediante EAP (Expected A Posteriori), eliminando el sesgo por desenganche y proporcionando un indicador de compromiso (engagement). Los candidatos con un compromiso inferior al 70% son automáticamente señalados en los informes.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-indigo-400 print:text-black">2.4 Person-Fit y Consistencia de Respuesta</h3>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-light">
              Se calcula el índice lz estandarizado (Drasgow et al., 1985) para evaluar si el patrón de respuestas del candidato es coherente con el modelo IRT. Valores inferiores a -2.0 indican patrones aberrantes (respuestas aleatorias, falta de esfuerzo o falseamiento extremo), activando alertas en el informe final.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-indigo-400 print:text-black">2.5 Equiparación de Puntuaciones (Test Equating)</h3>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-light">
              Cada vez que se actualiza el banco de ítems o se añaden nuevas formas paralelas, la plataforma ejecuta un procedimiento de equiparación basado en ítems ancla comunes a la versión anterior. Mediante el método Media-Sigma (Kolen & Brennan, 2014), se transforman los nuevos parámetros a la métrica base, garantizando que un θ de 1.0 tenga el mismo significado en cualquier momento. Todos los resultados históricos se recalculan retroactivamente para mantener la comparabilidad.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-indigo-400 print:text-black">2.6 Baremación Continua con GAMLSS</h3>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-light">
              Los baremos tradicionales sufren de “efecto escalón” y son poco fiables cuando hay pocos datos en ciertos cruces demográficos. Integrity Tech implementa modelos GAMLSS (Rigby & Stasinopoulos, 2005) para modelan la distribución condicional de θ según variables como país, sector o nivel educativo. Esto permite obtener percentiles suaves y precisos incluso para subgrupos pequeños, cumpliendo con el estándar de referencia en tests como el WISC‑V.
            </p>
          </div>
        </section>

        {/* 3. ARQUITECTURA */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-white border-l-2 border-indigo-500 pl-3 print:text-black print:border-black">3. Arquitectura del Sistema</h2>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-light">
            El motor psicométrico se despliega sobre NestJS (TypeScript) y PostgreSQL, con scripts de calibración en Python/R que se ejecutan en contenedores Docker. Los componentes clave son:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="p-4 bg-slate-900 border border-slate-900 rounded-xl text-left">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">ThetaCalculatorService</h4>
              <p className="text-2xs text-slate-400 mt-1 leading-relaxed">
                Estima θ mediante EAP con cuadratura de 5 nodos y aplica los coeficientes de equiparación psicométrica.
              </p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-900 rounded-xl text-left">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">CatService</h4>
              <p className="text-2xs text-slate-400 mt-1 leading-relaxed">
                Controla la entrega adaptativa de reactivos maximizando la información (MII) y regulando criterios de parada.
              </p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-900 rounded-xl text-left">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">ContinuousNormingService</h4>
              <p className="text-2xs text-slate-400 mt-1 leading-relaxed">
                Interpola linealmente los percentiles demográficos utilizando baremos continuos suavizados GAMLSS.
              </p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-900 rounded-xl text-left">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">RoiService</h4>
              <p className="text-2xs text-slate-400 mt-1 leading-relaxed">
                Estima la ganancia monetaria anual del cliente mediante el modelo Brogden-Cronbach-Gleser.
              </p>
            </div>
          </div>
        </section>

        {/* 4. EVIDENCIA DE VALIDEZ Y FIABILIDAD */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold text-white border-l-2 border-indigo-500 pl-3 print:text-black print:border-black">4. Evidencia de Validez y Fiabilidad</h2>
          
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-indigo-400 print:text-black">4.1 Fiabilidad</h3>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-light">
              <strong>Fiabilidad marginal (IRT):</strong> Calculada por integración Gauss-Hermite, superior a 0.85 para todos los tests tras la calibración con N &gt; 500.
            </p>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-light">
              <strong>Estabilidad temporal (test-retest):</strong> Evaluada con un intervalo de 4 semanas, con coeficientes superiores a 0.80.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-indigo-400 print:text-black">4.2 Validez de Constructo</h3>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-light">
              El análisis factorial confirmatorio respalda las estructuras esperadas: unidimensional para aptitud cognitiva, cinco factores para personalidad (Big Five), y dimensiones de honestidad-humildad y competencias interpersonales. Los índices de ajuste (CFI, TLI, RMSEA) se encuentran dentro de los rangos recomendados.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-indigo-400 print:text-black">4.3 Validez Predictiva</h3>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-light">
              El módulo de validez offline permite a cada cliente cargar datos de desempeño y calcular correlaciones (r de Pearson), regresiones múltiples y curvas ROC. En los estudios piloto, el IGA (combinación de los cuatro tests) muestra una correlación media corregida de 0.45 con el desempeño laboral, con un área bajo la curva ROC de 0.72 para la clasificación de alto desempeño, superando la mayoría de los instrumentos individuales del mercado (Schmidt & Hunter, 1998).
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-indigo-400 print:text-black">4.4 Equidad y Ausencia de Sesgo</h3>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-light">
              El análisis de Funcionamiento Diferencial del Ítem (DIF) y la monitorización continua del impacto adverso garantizan que las puntuaciones no favorecen injustamente a ningún grupo demográfico. Los ítems con DIF significativo se marcan para revisión manual y pueden ser desactivados.
            </p>
          </div>
        </section>

        {/* 5. FUNCIONALIDADES EMPRESARIALES */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-white border-l-2 border-indigo-500 pl-3 print:text-black print:border-black">5. Funcionalidades Empresariales Diferenciales</h2>
          <ul className="list-disc pl-5 text-xs md:text-sm text-slate-300 leading-relaxed font-light space-y-2">
            <li><strong>Índice Global de Adecuación (IGA):</strong> Permite a las organizaciones ponderar los cuatro tests según el perfil del puesto. El IGA se expresa en una escala percentil y se acompaña de una recomendación semaforizada y alertas críticas.</li>
            <li><strong>Informes narrativos inteligentes:</strong> El motor NLG traduce θ y percentiles en texto claro con recomendaciones y sugerencias de desarrollo.</li>
            <li><strong>ROI del talento:</strong> La calculadora Brogden-Cronbach-Gleser, integrada en la plataforma, traduce la mejora en la calidad de contratación en ahorro monetario anual.</li>
            <li><strong>Seguridad psicométrica:</strong> La combinación de person-fit, effort-moderated EAP y análisis de latencia proporciona una defensa robusta frente a fraudes y falsificaciones.</li>
          </ul>
        </section>

        {/* 6. CUMPLIMIENTO */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-white border-l-2 border-indigo-500 pl-3 print:text-black print:border-black">6. Cumplimiento y Seguridad</h2>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-light">
            La plataforma cumple con los estándares de protección de datos (GDPR, CCPA) mediante cifrado en reposo, seudonimización de datos para estudios de validez y consentimiento granular por parte del candidato. La arquitectura de bloqueos de concurrencia y las bitácoras de auditoría garantizan la integridad de los resultados.
          </p>
        </section>

        {/* 7. CONCLUSIÓN */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-white border-l-2 border-indigo-500 pl-3 print:text-black print:border-black">7. Conclusión</h2>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-light">
            Integrity Tech representa un salto cualitativo en la evaluación del talento. Al integrar IRT, CAT, baremación continua, modelado del esfuerzo y un completo sistema de validez, la plataforma ofrece a las organizaciones mediciones precisas, equitativas y directamente vinculadas al desempeño laboral. Su capacidad para generar informes accionables y cuantificar el retorno de inversión la convierte en una herramienta estratégica para la gestión moderna de recursos humanos.
          </p>
        </section>

        {/* REFERENCIAS */}
        <section className="flex flex-col gap-3 border-t border-slate-900 pt-6">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest print:text-black">Referencias</h2>
          <div className="flex flex-col gap-3 text-2xs text-slate-400 font-light leading-relaxed">
            <div>Drasgow, F., Levine, M. V., & Williams, E. A. (1985). Appropriateness measurement with polychotomous item response models. <em>British Journal of Mathematical and Statistical Psychology</em>, 38, 67‑86.</div>
            <div>Kolen, M. J., & Brennan, R. L. (2014). <em>Test equating, scaling, and linking</em>. Springer.</div>
            <div>Rigby, R. A., & Stasinopoulos, D. M. (2005). Generalized additive models for location, scale and shape. <em>Journal of the Royal Statistical Society: Series C</em>, 54, 507‑554.</div>
            <div>Schmidt, F. L., & Hunter, J. E. (1998). The validity and utility of selection methods in personnel psychology. <em>Psychological Bulletin</em>, 124, 262‑274.</div>
            <div>Wainer, H. (2000). <em>Computerized adaptive testing: A primer</em>. Lawrence Erlbaum.</div>
            <div>Wise, S. L., & DeMars, C. E. (2006). An application of item response time: The effort‑moderated IRT model. <em>Journal of Educational Measurement</em>, 43, 19‑38.</div>
          </div>
        </section>

      </article>

      {/* FOOTER DE IMPRESIÓN */}
      <footer className="max-w-4xl mx-auto text-center text-3xs text-slate-600 mt-12 print:text-black print:text-2xs font-mono">
        <div>© 2026 Integrity Tech Corp. Todos los derechos reservados.</div>
        <div>Documento técnico confidencial para uso informativo.</div>
      </footer>

    </div>
  );
}
