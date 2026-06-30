'use client';

import React, { useEffect, useState } from 'react';
import { useExamStore } from '../../../store/exam.store';
import { useSecureTimer } from '../../../hooks/useSecureTimer';
import { useProctoring } from '../../../hooks/useProctoring';
import { syncEngine } from '../../../services/sync-engine';
import { analyticsService } from '../../../services/analytics';
import { QuestionRenderer } from '../../../components/exam/QuestionRenderer';
import { ProctoringMonitor } from '../../../components/exam/ProctoringMonitor';
import { FeedbackLayer } from '../../../components/exam/FeedbackLayer';
import { ProctoringCamera } from '../../../components/exam/ProctoringCamera';
import { QuestionDto } from '../../../types/exam-contract';

// Simulación de carga de datos desde el backend en tiempo de carga de página (mock)
const MOCK_EXAM = {
  id: 'mock-exam-id-1111',
  title: 'Evaluación de Ingeniería de Software II',
  durationMinutes: 60,
};

const MOCK_QUESTIONS: QuestionDto[] = [
  {
    id: 'q-1',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'Al final de su turno, el cuadre de caja muestra un sobrante de $50 que no corresponde a ninguna venta. Usted sabe que ese dinero probablemente pasará desapercibido. ¿Qué hace?',
      options: [
        { id: 'opt-a', text: 'A) Lo guarda, total es un error del sistema y nadie lo notará.' },
        { id: 'opt-b', text: 'B) Lo reporta inmediatamente a su supervisor y lo deja registrado en el informe de cierre.' },
        { id: 'opt-c', text: 'C) Lo deja en la caja sin decir nada; si alguien lo reclama, que lo busque.' },
        { id: 'opt-d', text: 'D) Se lo queda como compensación por horas extra no pagadas.' },
      ],
    },
  },
  {
    id: 'q-2',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'Un compañero muy cercano le pide que marque su tarjeta de asistencia porque llegará 20 minutos tarde, asegurando que “nunca lo revisan”. Usted sabe que el reglamento lo prohíbe. ¿Cómo actúa?',
      options: [
        { id: 'opt-a', text: 'A) Accede, es un favor entre colegas y la amistad está primero.' },
        { id: 'opt-b', text: 'B) Se niega amablemente, explicando que prefiere no violar la norma, y sugiere que él hable con el jefe.' },
        { id: 'opt-c', text: 'C) Lo hace, pero le advierte que es la última vez.' },
        { id: 'opt-d', text: 'D) Lo ignora y no marca nada; que él resuelva su problema.' },
      ],
    },
  },
  {
    id: 'q-3',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'Encuentra en la impresora un informe con datos confidenciales de salarios de varios empleados. Su puesto no le da acceso a esa información. ¿Qué hace?',
      options: [
        { id: 'opt-a', text: 'A) Lo lee detenidamente para saber cómo están los demás.' },
        { id: 'opt-b', text: 'B) Lo recoge y lo entrega de inmediato a Recursos Humanos o a su supervisor directo, sin leerlo.' },
        { id: 'opt-c', text: 'C) Lo deja donde está, no es asunto suyo.' },
        { id: 'opt-d', text: 'D) Lo fotocopia “por si acaso” y después lo devuelve discretamente.' },
      ],
    },
  },
  {
    id: 'q-4',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'Un proveedor con quien su empresa tiene un contrato en licitación le ofrece una tarjeta de regalo de $200 como “agradecimiento por la buena relación”. Las políticas internas prohíben recibir obsequios superiores a $25. Usted:',
      options: [
        { id: 'opt-a', text: 'A) La acepta, no cree que eso influya en sus decisiones profesionales.' },
        { id: 'opt-b', text: 'B) La rechaza cortésmente y notifica el ofrecimiento al área de compras/ética.' },
        { id: 'opt-c', text: 'C) La acepta pero la declara informalmente a su jefe.' },
        { id: 'opt-d', text: 'D) La acepta y la comparte con el equipo para que nadie hable.' },
      ],
    },
  },
  {
    id: 'q-5',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'Su jefe le pide que “ajuste” ligeramente una cifra en un reporte de resultados para que el área quede mejor parada. El cambio no es ilegal pero desvirtúa la realidad. Usted:',
      options: [
        { id: 'opt-a', text: 'A) Lo hace, es su jefe y hay que alinearse.' },
        { id: 'opt-b', text: 'B) Se niega explicando que prefiere mantener la exactitud de los datos y ofrece alternativas para presentar los resultados sin falsearlos.' },
        { id: 'opt-c', text: 'C) Lo hace, pero deja una nota interna aclaratoria por si acaso.' },
        { id: 'opt-d', text: 'D) Lo deriva a un colega para no tener que involucrarse directamente.' },
      ],
    },
  },
];

export default function ExamTakingPage({ params }: { params: { attemptId: string } }) {
  const attemptId = params.attemptId;
  const startExam = useExamStore((state) => state.startExam);
  const status = useExamStore((state) => state.status);
  const setStatus = useExamStore((state) => state.setStatus);
  const isOffline = useExamStore((state) => state.isOffline);
  const answers = useExamStore((state) => state.answers);

  // Estados locales para simular la hora sincronizada del servidor
  const [initialServerTimeMs] = useState(Date.now());
  const [endTimeMs] = useState(Date.now() + 10 * 60 * 1000); // 10 minutos de duración para la demostración
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [showFeedbackSurvey, setShowFeedbackSurvey] = useState(false);

  // Inicializar el store de Zustand con los parámetros de la sesión
  useEffect(() => {
    startExam(attemptId, MOCK_EXAM.id);
    // Tracking de inicio de sesión de evaluación (PMF Feedback Loop)
    analyticsService.track('assessment_started', { attemptId, examId: MOCK_EXAM.id });
  }, [attemptId, startExam]);

  // Tracking de navegación de preguntas para embudos de drop-off
  const activeQuestion = MOCK_QUESTIONS[activeQuestionIndex];
  useEffect(() => {
    if (activeQuestion) {
      analyticsService.track('question_viewed', {
        attemptId,
        questionId: activeQuestion.id,
        questionIndex: activeQuestionIndex,
        questionType: activeQuestion.type,
      });
    }
  }, [activeQuestionIndex, attemptId, activeQuestion]);

  // Manejo de la expiración de tiempo (Auto-Submit)
  const handleTimeUp = () => {
    if (status === 'IN_PROGRESS') {
      setStatus('EXPIRED');
      console.warn('El tiempo del examen ha expirado. Forzando envío automático...');
      triggerFinalSubmit();
    }
  };

  // Manejo de alarmas por alteración del reloj local
  const handleClockTampered = () => {
    alert('⚠️ Se ha detectado una alteración en el reloj de tu dispositivo. El examen se guardará y bloqueará.');
    handleTimeUp();
  };

  // Hook del Temporizador Seguro
  const { formattedTime, isExpired } = useSecureTimer({
    initialServerTimeMs,
    endTimeMs,
    onTimeUp: handleTimeUp,
    onTamperDetected: handleClockTampered,
  });

  // Activar monitoreo silencioso de Proctoring (inactividad e integridad de pestaña)
  useProctoring({ idleTimeoutMs: 60000 });

  // Envío final del examen
  const triggerFinalSubmit = async () => {
    setStatus('SUBMITTED');
    setShowFeedbackSurvey(true); // Mostrar encuesta NPS ante entrega

    // Tracking de finalización del examen (PMF Feedback Loop)
    analyticsService.track('assessment_submitted', { attemptId });
    console.log('Enviando respuestas consolidadas al backend:', answers);

    // En un flujo real, aquí llamamos a:
    // fetch(`/api/evaluations/attempts/${attemptId}/finalize`, { method: 'POST' })
    // Si falla por red, el SyncEngine se encargará de encolar el cierre definitivo.
    alert('Examen enviado con éxito. Tus respuestas se han sincronizado.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* CABECERA (Header) - Responsiva para Móvil/Escritorio */}
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 md:px-6 py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0">
        <div className="w-full md:w-auto">
          <h1 className="text-sm font-bold text-slate-200 tracking-wide text-left">{MOCK_EXAM.title}</h1>
          <p className="text-3xs text-slate-500 mt-0.5">ID de Intento: {attemptId}</p>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto border-t border-slate-800/40 md:border-none pt-2.5 md:pt-0">
          {/* Indicador de Estado de Conexión */}
          {isOffline ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-3xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Modo Offline
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-3xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Sincronizado
            </span>
          )}

          {/* Temporizador Seguro */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-3xs text-slate-500 uppercase font-mono">Restan:</span>
            <span className={`font-mono text-xs font-bold ${isExpired ? 'text-red-500' : 'text-indigo-400'}`}>
              {formattedTime}
            </span>
          </div>
        </div>
      </header>

      {/* ÁREA DE CONTENIDO */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col gap-6">
        
        {/* Encuesta NPS de Retroalimentación en Caliente (Product-Market Fit) */}
        {showFeedbackSurvey ? (
          <FeedbackLayer 
            attemptId={attemptId}
            onFeedbackSubmitted={() => setShowFeedbackSurvey(false)}
          />
        ) : status !== 'IN_PROGRESS' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl gap-4 my-auto">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center text-3xl">
              {status === 'SUBMITTED' ? '✅' : '⏳'}
            </div>
            <h2 className="text-xl font-bold text-slate-100">
              {status === 'SUBMITTED' ? 'Examen Entregado' : 'Tiempo Expirado'}
            </h2>
            <p className="text-sm text-slate-400 max-w-md">
              El examen ha sido cerrado y tus respuestas se encuentran procesadas de forma segura. No puedes realizar más modificaciones.
            </p>
          </div>
        ) : (
          <>
            {/* Indicador de Navegación de Preguntas */}
            <div className="flex gap-2 justify-center py-2 border-b border-slate-900">
              {MOCK_QUESTIONS.map((_, index) => {
                const isAnswered = !!answers[MOCK_QUESTIONS[index].id];
                const isActive = index === activeQuestionIndex;
                return (
                  <button
                    key={index}
                    onClick={() => setActiveQuestionIndex(index)}
                    className={`w-10 h-10 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
                      isActive 
                        ? 'bg-indigo-600 text-white ring-2 ring-indigo-500/30' 
                        : isAnswered 
                          ? 'bg-slate-800 text-slate-300 border border-slate-700' 
                          : 'bg-slate-950 text-slate-500 border border-slate-900 hover:bg-slate-900'
                    }`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>

            {/* Renderizador de Pregunta Activa */}
            <div className="flex-1">
              {activeQuestion && (
                <QuestionRenderer question={activeQuestion} />
              )}
            </div>

            {/* Supervisión Activa por Cámara (Webcam Proctoring) - Ubicación Inline Perfecta */}
            <ProctoringCamera attemptId={attemptId} activeQuestionIndex={activeQuestionIndex} />

            {/* Botones de Navegación del Examen */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-900">
              <button
                disabled={activeQuestionIndex === 0}
                onClick={() => setActiveQuestionIndex((prev) => prev - 1)}
                className="px-6 py-2.5 rounded-lg border border-slate-800 text-slate-400 text-sm font-medium hover:bg-slate-900/50 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                Anterior
              </button>

              {activeQuestionIndex < MOCK_QUESTIONS.length - 1 ? (
                <button
                  onClick={() => setActiveQuestionIndex((prev) => prev + 1)}
                  className="px-6 py-2.5 rounded-lg bg-slate-800 text-slate-200 text-sm font-medium hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Siguiente
                </button>
              ) : (
                <button
                  onClick={triggerFinalSubmit}
                  className="px-8 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  Finalizar y Entregar
                </button>
              )}
            </div>
          </>
        )}
      </main>

      {/* Alerta de Auditoría de Proctoring de Alto Riesgo */}
      <ProctoringMonitor />
    </div>
  );
}
