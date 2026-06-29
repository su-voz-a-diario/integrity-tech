'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useExamStore } from '../../../store/exam.store';
import { SecureTimerView } from '../../../components/exam/SecureTimerView';
import { QuestionRenderer } from '../../../components/exam/QuestionRenderer';
import { QuestionDto } from '../../../types/exam-contract';

const MOCK_EXAM = {
  id: 'mock-exam-id-1111',
  title: 'Evaluación de Ingeniería de Software II',
  durationMinutes: 60,
};

const MOCK_QUESTIONS: QuestionDto[] = [
  {
    id: 'q-1',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.5,
    content: {
      text: '¿Cuál es el beneficio principal de un Monolito Modular frente a Microservicios al iniciar un proyecto?',
      options: [
        { id: 'opt-a', text: 'Menor la latencia de red y despliegue unificado sin overhead operativo.' },
        { id: 'opt-b', text: 'Facilidad de escalabilidad regional automatizada en la nube.' },
        { id: 'opt-c', text: 'Permite compartir bases de datos relacionales sin límites de dominio.' },
      ],
    },
  },
  {
    id: 'q-2',
    type: 'TRUE_FALSE',
    defaultPoints: 1.5,
    content: {
      text: 'En NestJS, los proveedores son públicos para todos los módulos de la aplicación por defecto.',
    },
  },
  {
    id: 'q-3',
    type: 'SHORT_ANSWER',
    defaultPoints: 2.0,
    content: {
      text: '¿Qué método atómico de Redis se utiliza habitualmente en procesadores distribuidos para evitar race conditions al decrementar un contador?',
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
  
  // Soporte para preguntas marcadas
  const flaggedQuestions = useExamStore((state) => state.flaggedQuestions);
  const toggleFlag = useExamStore((state) => state.toggleFlag);

  const [initialServerTimeMs] = useState(Date.now());
  const [endTimeMs] = useState(Date.now() + 15 * 60 * 1000); // 15 minutos
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  // Inicializar store
  useEffect(() => {
    startExam(attemptId, MOCK_EXAM.id);
  }, [attemptId, startExam]);

  // ============================================================================
  // CONTROL DE ACCESIBILIDAD POR TECLADO (A11y)
  // ============================================================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== 'IN_PROGRESS') return;

      // Evitamos disparar acciones si el usuario está escribiendo en un textarea de respuesta abierta
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      if (e.key === 'ArrowRight' && !isInputActive) {
        e.preventDefault();
        navigateQuestion('next');
      } else if (e.key === 'ArrowLeft' && !isInputActive) {
        e.preventDefault();
        navigateQuestion('prev');
      } else if (e.key === 'f' && !isInputActive) {
        // Presionar 'F' marca/desmarca la pregunta activa para revisión
        e.preventDefault();
        const activeQ = MOCK_QUESTIONS[activeQuestionIndex];
        if (activeQ) toggleFlag(activeQ.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeQuestionIndex, status]);

  const navigateQuestion = (direction: 'next' | 'prev') => {
    if (direction === 'next' && activeQuestionIndex < MOCK_QUESTIONS.length - 1) {
      setActiveQuestionIndex((prev) => prev + 1);
    } else if (direction === 'prev' && activeQuestionIndex > 0) {
      setActiveQuestionIndex((prev) => prev - 1);
    }
  };

  const handleTimeUp = () => {
    if (status === 'IN_PROGRESS') {
      setStatus('EXPIRED');
      triggerFinalSubmit();
    }
  };

  const handleClockTampered = () => {
    alert('⚠️ Desviación en el reloj detectada. Guardando examen por seguridad.');
    handleTimeUp();
  };

  const triggerFinalSubmit = async () => {
    setStatus('SUBMITTED');
    alert('Examen entregado correctamente. Gracias por completar la evaluación.');
  };

  const activeQuestion = MOCK_QUESTIONS[activeQuestionIndex];
  const isQuestionFlagged = activeQuestion ? !!flaggedQuestions[activeQuestion.id] : false;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* CABECERA (Header) */}
      <header className="sticky top-0 z-10 bg-slate-900/60 backdrop-blur-md border-b border-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-sm font-semibold tracking-wide text-slate-200 uppercase">{MOCK_EXAM.title}</h1>
          <p className="text-[10px] font-mono text-slate-500">ID Sesión: {attemptId}</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Indicador de Red */}
          {isOffline ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 select-none animate-pulse">
              Conexión Inestable (Guardado Local)
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 select-none">
              Online
            </span>
          )}

          {/* Temporizador Sin-Lag */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg">
            <span className="text-[10px] text-slate-500 font-mono select-none uppercase">Tiempo:</span>
            <SecureTimerView
              initialServerTimeMs={initialServerTimeMs}
              endTimeMs={endTimeMs}
              onTimeUp={handleTimeUp}
              onTamperDetected={handleClockTampered}
            />
          </div>
        </div>
      </header>

      {/* ÁREA DE CONTENIDO PRINCIPAL */}
      <main className="flex-1 flex w-full max-w-7xl mx-auto overflow-hidden">
        
        {/* PANEL LATERAL DE NAVEGACIÓN (Sidebar) */}
        <aside className="w-80 border-r border-slate-900 bg-slate-950/30 p-6 flex flex-col gap-6 select-none hidden md:flex">
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Navegación</h2>
            <div className="grid grid-cols-5 gap-2">
              {MOCK_QUESTIONS.map((q, index) => {
                const isAnswered = !!answers[q.id];
                const isFlagged = !!flaggedQuestions[q.id];
                const isActive = index === activeQuestionIndex;
                
                return (
                  <button
                    key={q.id}
                    onClick={() => setActiveQuestionIndex(index)}
                    aria-label={`Ir a pregunta ${index + 1}`}
                    className={`w-11 h-11 rounded-lg text-xs font-bold transition-all relative flex items-center justify-center border ${
                      isActive 
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/10' 
                        : isFlagged 
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' 
                          : isAnswered 
                            ? 'bg-slate-900 text-slate-300 border-slate-800' 
                            : 'bg-slate-950 text-slate-600 border-slate-900 hover:border-slate-800'
                    }`}
                  >
                    {index + 1}
                    {/* Indicador de 🚩 bandera de revisión */}
                    {isFlagged && (
                      <span className="absolute top-0.5 right-0.5 text-[8px]">🚩</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Leyenda explicativa de estados */}
          <div className="mt-auto p-4 bg-slate-900/40 border border-slate-900 rounded-xl space-y-2 text-xs text-slate-500">
            <h3 className="font-semibold text-slate-400">Guía de Teclado</h3>
            <div className="flex justify-between"><span>Siguiente:</span> <kbd className="px-1.5 py-0.5 bg-slate-900 rounded border border-slate-800 font-mono">→</kbd></div>
            <div className="flex justify-between"><span>Anterior:</span> <kbd className="px-1.5 py-0.5 bg-slate-900 rounded border border-slate-800 font-mono">←</kbd></div>
            <div className="flex justify-between"><span>Marcar:</span> <kbd className="px-1.5 py-0.5 bg-slate-900 rounded border border-slate-800 font-mono">F</kbd></div>
          </div>
        </aside>

        {/* ÁREA CENTRAL DE LA PREGUNTA */}
        <section className="flex-1 flex flex-col p-8 overflow-y-auto">
          {status !== 'IN_PROGRESS' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto gap-4">
              <div className="text-4xl">🏁</div>
              <h2 className="text-xl font-bold">Sesión Finalizada</h2>
              <p className="text-sm text-slate-500">
                La prueba ha concluido. Tu examen ha sido encolado para persistencia y evaluación. Puedes cerrar esta ventana con seguridad.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto gap-6">
              
              {/* Barra de progreso sutil */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Pregunta {activeQuestionIndex + 1} de {MOCK_QUESTIONS.length}</span>
                  <span>{Math.round((Object.keys(answers).length / MOCK_QUESTIONS.length) * 100)}% Completado</span>
                </div>
                <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 transition-all duration-300 ease-out" 
                    style={{ width: `${(Object.keys(answers).length / MOCK_QUESTIONS.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Botón de Flag para revisión */}
              <div className="flex justify-end">
                <button
                  onClick={() => toggleFlag(activeQuestion.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    isQuestionFlagged
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20'
                      : 'border-slate-800 text-slate-400 hover:bg-slate-900/50 hover:text-slate-300'
                  }`}
                >
                  <span>🚩</span>
                  {isQuestionFlagged ? 'Marcada para revisión' : 'Marcar para revisión'}
                </button>
              </div>

              {/* Animación fluida de transiciones entre preguntas */}
              <div className="flex-1 transition-all duration-200 transform translate-y-0 opacity-100">
                {activeQuestion && (
                  <QuestionRenderer question={activeQuestion} />
                )}
              </div>

              {/* Barra de navegación inferior */}
              <div className="flex justify-between items-center mt-auto pt-6 border-t border-slate-900">
                <button
                  disabled={activeQuestionIndex === 0}
                  onClick={() => navigateQuestion('prev')}
                  className="px-5 py-2.5 rounded-lg border border-slate-800 text-slate-400 text-sm font-medium hover:bg-slate-900/50 disabled:opacity-30 disabled:pointer-events-none transition-all"
                >
                  Anterior
                </button>

                {activeQuestionIndex < MOCK_QUESTIONS.length - 1 ? (
                  <button
                    onClick={() => navigateQuestion('next')}
                    className="px-5 py-2.5 rounded-lg bg-slate-800 text-slate-200 text-sm font-medium hover:bg-slate-700 transition-all"
                  >
                    Siguiente
                  </button>
                ) : (
                  <button
                    onClick={triggerFinalSubmit}
                    className="px-7 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-600/15 transition-all"
                  >
                    Finalizar y Entregar
                  </button>
                )}
              </div>

            </div>
          )}
        </section>
      </main>
    </div>
  );
}
