'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useExamStore } from '../../../store/exam.store';
import { useSecureTimer } from '../../../hooks/useSecureTimer';
import { useProctoring } from '../../../hooks/useProctoring';
import { syncEngine } from '../../../services/sync-engine';
import { analyticsService } from '../../../services/analytics';
import { TopNavigation } from '../../../components/navigation/TopNavigation';
import { QuestionRenderer } from '../../../components/exam/QuestionRenderer';
import { ProctoringMonitor } from '../../../components/exam/ProctoringMonitor';
import { FeedbackLayer } from '../../../components/exam/FeedbackLayer';
import { ProctoringCamera } from '../../../components/exam/ProctoringCamera';
import { QuestionDto } from '../../../types/exam-contract';
import { apiClient, ApiClientError } from '../../../services/api-client';
import type { CandidateConsentResponse, ExamSessionResponse } from '../../../generated/api/types';

const CONSENT_VERSION = 'candidate-consent-v1';

function getProfessionalErrorMessage(status: number, fallback: string) {
  const messages: Record<number, string> = {
    401: 'Tu sesión expiró o no es válida. Vuelve a ingresar con tu enlace de evaluación.',
    403: 'No tienes autorización para acceder a esta evaluación.',
    409: 'El estado actual del intento no permite realizar esta acción.',
    429: 'Hay demasiadas solicitudes en este momento. Espera unos minutos e inténtalo nuevamente.',
  };
  return messages[status] || fallback;
}

export default function ExamTakingPage({ params }: { params: { attemptId: string } }) {
  const attemptId = params.attemptId;
  const startExam = useExamStore((state) => state.startExam);
  const status = useExamStore((state) => state.status);
  const setStatus = useExamStore((state) => state.setStatus);
  const isOffline = useExamStore((state) => state.isOffline);
  const answers = useExamStore((state) => state.answers);

  const [examSession, setExamSession] = useState<{
    attemptId?: string;
    exam: { id: string; title: string; durationMinutes?: number | null };
    questions: QuestionDto[];
    status: string;
  } | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isAcceptingConsent, setIsAcceptingConsent] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [initialServerTimeMs] = useState(Date.now());
  const [endTimeMs, setEndTimeMs] = useState(Date.now() + 10 * 60 * 1000);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [showFeedbackSurvey, setShowFeedbackSurvey] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const data = await apiClient.get<ExamSessionResponse>(`/evaluations/attempts/${attemptId}/session`);
      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error('La evaluación no tiene preguntas configuradas.');
      }

      setExamSession(data);
      startExam(attemptId, data.exam.id);
      setStatus(data.status === 'SUBMITTED' ? 'SUBMITTED' : 'IN_PROGRESS');
      const durationMinutes = data.exam.durationMinutes || 10;
      setEndTimeMs(Date.now() + durationMinutes * 60 * 1000);
      analyticsService.track('assessment_started', { attemptId, examId: data.exam.id });
    } catch (err: any) {
      const fallback = err.message || 'No se pudo cargar la sesión de examen.';
      setSessionError(err instanceof ApiClientError ? getProfessionalErrorMessage(err.status, fallback) : fallback);
    } finally {
      setIsLoadingSession(false);
    }
  }, [attemptId, startExam, setStatus]);

  // Inicializar el store de Zustand con los parámetros de la sesión
  useEffect(() => {
    async function verifyConsentAndLoadSession() {
      try {
        const data = await apiClient.get<CandidateConsentResponse>(`/evaluations/attempts/${attemptId}/consent`);
        if (!data.accepted) {
          setConsentAccepted(false);
          setIsLoadingSession(false);
          return;
        }

        setConsentAccepted(true);
        await loadSession();
      } catch (err: any) {
        const fallback = err.message || 'No se pudo preparar la evaluación.';
        setSessionError(err instanceof ApiClientError ? getProfessionalErrorMessage(err.status, fallback) : fallback);
        setIsLoadingSession(false);
      }
    }

    verifyConsentAndLoadSession();
  }, [attemptId, loadSession]);

  const acceptConsent = async () => {
    try {
      setIsAcceptingConsent(true);
      setConsentError(null);
      await apiClient.post<CandidateConsentResponse>(`/evaluations/attempts/${attemptId}/consent`, { consentVersion: CONSENT_VERSION });

      setConsentAccepted(true);
      setIsLoadingSession(true);
      await loadSession();
    } catch (err: any) {
      const fallback = err.message || 'No se pudo registrar el consentimiento.';
      setConsentError(err instanceof ApiClientError ? getProfessionalErrorMessage(err.status, fallback) : fallback);
    } finally {
      setIsAcceptingConsent(false);
    }
  };

  // Tracking de navegación de preguntas para embudos de drop-off
  const questions = examSession?.questions || [];
  const activeQuestion = questions[activeQuestionIndex];
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
    try {
      const flushed = await syncEngine?.flushAnswers(6000);
      if (flushed === false) {
        throw new Error('Aún hay respuestas pendientes de sincronización. Espera unos segundos y vuelve a finalizar.');
      }

      await apiClient.post(`/evaluations/attempts/${attemptId}/finalize`);

      setStatus('SUBMITTED');
      setShowFeedbackSurvey(true);
      analyticsService.track('assessment_submitted', { attemptId });
      console.log('Respuestas locales al finalizar:', answers);
    } catch (err: any) {
      const fallback = err.message || 'No se pudo finalizar la evaluación. Revisa tu conexión e inténtalo de nuevo.';
      alert(err instanceof ApiClientError ? getProfessionalErrorMessage(err.status, fallback) : fallback);
    }
  };

  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <TopNavigation />
        <div className="text-sm text-slate-500 font-medium">Cargando evaluación asignada...</div>
      </div>
    );
  }

  if (!consentAccepted && !examSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans p-6 pt-20">
        <TopNavigation />
        <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h1 className="text-lg font-bold text-white">Consentimiento informado</h1>
          <div className="mt-4 space-y-3 text-sm text-slate-300 leading-relaxed">
            <p>
              Autorizo realizar esta evaluación como parte de un proceso de selección o valoración profesional.
            </p>
            <p>
              Acepto que mis respuestas y datos asociados al intento sean tratados para generar resultados, métricas y
              reportes relacionados con la evaluación.
            </p>
            <p>
              Entiendo que la sesión puede registrar señales de monitoreo o proctoring cuando aplique, como eventos de
              navegación, actividad de sesión o metadata técnica.
            </p>
            <p>
              Comprendo que los resultados podrán ser usados por la organización solicitante como una herramienta de
              apoyo para la toma de decisiones dentro del proceso correspondiente.
            </p>
            <p className="text-xs text-slate-500">Versión del consentimiento: {CONSENT_VERSION}</p>
          </div>
          {consentError && <p className="mt-4 text-sm text-red-400">{consentError}</p>}
          <button
            type="button"
            onClick={acceptConsent}
            disabled={isAcceptingConsent}
            className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAcceptingConsent ? 'Registrando...' : 'Acepto y continuar'}
          </button>
        </div>
      </div>
    );
  }

  if (sessionError || !examSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans p-6 pt-20">
        <TopNavigation />
        <div className="max-w-md text-center bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h1 className="text-lg font-bold text-white">No se pudo abrir la evaluación</h1>
          <p className="text-sm text-slate-400 mt-2">{sessionError || 'La sesión no está disponible.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* CABECERA (Header) - Responsiva para Móvil/Escritorio */}
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 md:px-6 py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0">
        <div className="w-full md:w-auto flex items-center gap-3.5">
          <img 
            src="/integrity-logo-2.png" 
            alt="Logo" 
            className="w-7 h-7 object-contain rounded-md flex-shrink-0"
          />
          <div>
            <h1 className="text-sm font-bold text-slate-200 tracking-wide text-left">{examSession.exam.title}</h1>
            <p className="text-3xs text-slate-500 mt-0.5">ID de Intento: {attemptId}</p>
          </div>
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
            {/* Indicador de Navegación de Preguntas (Minimalista y Unificado) */}
            <div className="flex justify-center items-center py-3 border-b border-slate-900">
              <span className="text-2xs uppercase tracking-widest font-mono text-slate-500 font-semibold">
                Pregunta <span className="text-indigo-400 font-bold text-sm mx-1">{activeQuestionIndex + 1}</span> de <span className="text-slate-300 font-bold text-sm mx-1">{questions.length}</span>
              </span>
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

              {activeQuestionIndex < questions.length - 1 ? (
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
