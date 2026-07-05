'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { TopNavigation } from '../../../components/navigation/TopNavigation';
import { apiClient, ApiClientError } from '../../../services/api-client';
import type { AttemptListItem, CreateInvitationRequest, CreateInvitationResponse } from '../../../generated/api/types';

type ExamOption = {
  id: string;
  title: string;
  description?: string | null;
};

function getDashboardErrorMessage(status: number) {
  const messages: Record<number, string> = {
    401: 'Tu sesión expiró. Vuelve a iniciar sesión para consultar candidatos.',
    403: 'No tienes permisos para consultar intentos de evaluación.',
    429: 'Demasiadas solicitudes al dashboard. Espera unos minutos e inténtalo nuevamente.',
  };
  return messages[status] || 'No se pudieron cargar los intentos reales.';
}

export default function RecruiterDashboard() {
  const [filter, setFilter] = useState<'ALL' | 'SAFE' | 'WARNING' | 'CRITICAL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [attempts, setAttempts] = useState<AttemptListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [availableExams, setAvailableExams] = useState<ExamOption[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(true);
  const [examsError, setExamsError] = useState<string | null>(null);

  // Estados para Modal de Invitaciones
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    candidateName: '',
    email: '',
    examId: '',
  });
  const [generatedInvite, setGeneratedInvite] = useState<{
    accessCode: string;
    directLink: string;
  } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.candidateName || !inviteForm.email || !inviteForm.examId) {
      setInviteError('Por favor complete todos los campos y selecciona una evaluación real.');
      return;
    }
    
    setIsInviting(true);
    setInviteError(null);
    
    try {
      const payload: CreateInvitationRequest = inviteForm;
      const data = await apiClient.post<CreateInvitationResponse>('/evaluations/invitations', payload);
      setGeneratedInvite(data);
    } catch (err: any) {
      const fallback = err.message || 'Error al conectar con la API.';
      setInviteError(err instanceof ApiClientError ? getDashboardErrorMessage(err.status) : fallback);
    } finally {
      setIsInviting(false);
    }
  };

  // Carga asíncrona de datos desde la API
  useEffect(() => {
    apiClient.get<AttemptListItem[]>('/evaluations/attempts')
      .then((data) => {
        setAttempts(Array.isArray(data) ? data : []);
        setDashboardError(null);
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn('[Dashboard] No se pudieron cargar intentos reales:', err);
        setDashboardError(err instanceof ApiClientError ? getDashboardErrorMessage(err.status) : (err.message || 'No se pudieron cargar los intentos reales.'));
        setAttempts([]);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    apiClient.get<ExamOption[]>('/exams')
      .then((data) => {
        const exams = Array.isArray(data) ? data.filter((exam) => exam?.id && exam?.title) : [];
        setAvailableExams(exams);
        setInviteForm((current) => ({
          ...current,
          examId: current.examId || exams[0]?.id || '',
        }));
        setExamsError(null);
      })
      .catch((err) => {
        console.warn('[Dashboard] No se pudieron cargar evaluaciones reales:', err);
        setAvailableExams([]);
        setInviteForm((current) => ({ ...current, examId: '' }));
        setExamsError('No hay evaluaciones reales disponibles para invitar candidatos.');
      })
      .finally(() => setIsLoadingExams(false));
  }, []);

  // Filtrado de candidatos basado en las interacciones
  const filteredAttempts = attempts.filter((attempt) => {
    const matchesFilter = filter === 'ALL' || attempt.riskStatus === filter;
    const matchesSearch = attempt.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          attempt.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 pt-20 md:p-8 md:pt-20">
      <TopNavigation />
      <div className="max-w-6xl mx-auto flex flex-col gap-6 md:gap-8">
        
        {/* ENCABEZADO - Responsivo para Móvil/Escritorio */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-900 pb-6 gap-4 md:gap-0">
          <div className="w-full md:w-auto flex items-center gap-3">
            <img 
              src="/integrity-logo-2.png" 
              alt="Integrity Logo" 
              className="w-10 h-10 object-contain rounded-lg flex-shrink-0"
            />
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white text-left">Consola de Selección</h1>
              <p className="text-xs md:text-sm text-slate-400 mt-0.5 leading-relaxed text-left">
                Monitoreo de perfiles psicométricos y auditoría de integridad conductual (Proctoring).
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-slate-900/30 border border-slate-800 py-1.5 px-3 rounded-lg">
              <span className="text-3xs text-slate-500 font-semibold uppercase tracking-wider">Empresa Cliente:</span>
              <span className="text-xs font-bold text-indigo-400">
                Integrity-Tech Corp
              </span>
            </div>
            <Link 
              href="/ciencia" 
              target="_blank"
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-850 border border-indigo-500/20 hover:border-indigo-500/40 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-200 transition-all cursor-pointer shadow-sm shadow-indigo-500/5"
            >
              🔬 Fundamentos Científicos (White Paper)
            </Link>
          </div>
        </div>

        {/* METRICAS RAPIDAS (KPI CARDS) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <div className="bg-slate-900 border border-slate-900 p-5 md:p-6 rounded-xl shadow-md text-left">
            <p className="text-3xs font-bold text-slate-500 uppercase tracking-widest">Total Evaluados</p>
            <h3 className="text-2xl md:text-3xl font-bold text-slate-100 mt-2">{attempts.length}</h3>
            <p className="text-3xs text-slate-400 mt-2">
              Basado en intentos reales cargados desde la API
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-900 p-5 md:p-6 rounded-xl shadow-md text-left">
            <p className="text-3xs font-bold text-slate-500 uppercase tracking-widest">Índice de Integridad</p>
            <h3 className="text-2xl md:text-3xl font-bold text-slate-100 mt-2">N/D</h3>
            <p className="text-3xs text-slate-400 mt-2">
              Métrica disponible cuando el backend entregue datos agregados
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-900 p-5 md:p-6 rounded-xl shadow-md border-r-amber-500/20 text-left">
            <p className="text-3xs font-bold text-slate-500 uppercase tracking-widest text-amber-500">Alertas Críticas</p>
            <h3 className="text-2xl md:text-3xl font-bold text-amber-500 mt-2">N/D</h3>
            <p className="text-3xs text-slate-400 mt-2">
              Sin endpoint real de métricas críticas conectado
            </p>
          </div>
        </div>

        {/* FILTROS Y CONTROLES */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center bg-slate-900/40 p-4 border border-slate-900 rounded-xl">
          <div className="relative w-full lg:w-80">
            <input
              type="text"
              placeholder="Buscar candidato o correo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-4 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all text-left"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-stretch sm:items-center justify-between lg:justify-end">
            {/* Contenedor de filtros con scroll horizontal en móvil */}
            <div className="flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none pb-1.5 sm:pb-0 w-full sm:w-auto">
              {(['ALL', 'SAFE', 'WARNING', 'CRITICAL'] as const).map((type) => {
                const labels: Record<string, string> = {
                  ALL: 'Todos',
                  SAFE: 'Sin Alertas',
                  WARNING: 'Sospechosos',
                  CRITICAL: 'Fraude Probable',
                };
                const isActive = filter === type;
                return (
                  <button
                    key={type}
                    onClick={() => setFilter(type)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:bg-slate-900 border border-slate-900'
                    }`}
                  >
                    {labels[type]}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                setGeneratedInvite(null);
                setInviteError(null);
                setInviteForm({ candidateName: '', email: '', examId: availableExams[0]?.id || '' });
                setIsInviteModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer transition-all flex items-center justify-center gap-1.5 whitespace-nowrap w-full sm:w-auto shadow-md shadow-indigo-600/10"
            >
              ✉️ Invitar Candidato
            </button>
          </div>
        </div>

        {dashboardError && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {dashboardError}
          </div>
        )}

        {/* VISTA DESKTOP: LISTADO DE CANDIDATOS (TABLA) */}
        <div className="hidden md:block bg-slate-900/30 border border-slate-900 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-900 text-left">
              <thead className="bg-slate-900/60 text-2xs uppercase tracking-wider font-bold text-slate-500">
                <tr>
                  <th className="px-6 py-4">Candidato</th>
                  <th className="px-6 py-4">Evaluación</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4 text-center">Calificación</th>
                  <th className="px-6 py-4 text-center">Incidencias</th>
                  <th className="px-6 py-4 text-center">Estatus Riesgo</th>
                  <th className="px-6 py-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-sm text-slate-300">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-medium">
                      Cargando bandeja de selección...
                    </td>
                  </tr>
                ) : filteredAttempts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-medium">
                      No se encontraron candidatos con los criterios especificados.
                    </td>
                  </tr>
                ) : (
                  filteredAttempts.map((attempt) => (
                    <tr key={attempt.id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-100">{attempt.candidateName}</div>
                        <div className="text-xs text-slate-500">{attempt.email}</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-400">
                        {attempt.assessmentTitle}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {attempt.date}
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-bold text-indigo-400">
                        {attempt.overallScore}
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-xs text-slate-400">
                        {attempt.incidentsCount}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                          attempt.riskStatus === 'SAFE'
                            ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
                            : attempt.riskStatus === 'WARNING'
                              ? 'bg-amber-500/10 text-amber-400 ring-amber-500/20'
                              : 'bg-red-500/10 text-red-400 ring-red-500/20'
                        }`}>
                          {attempt.statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/recruiter/attempts/${attempt.id}`}
                          className="inline-flex items-center justify-center rounded-lg bg-slate-950 border border-slate-800 text-xs font-semibold px-3 py-1.5 text-indigo-400 hover:bg-slate-900 hover:text-indigo-300 transition-all"
                        >
                          Ver Reporte
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* VISTA MÓVIL: TARJETAS DE CANDIDATOS */}
        <div className="block md:hidden space-y-4">
          {isLoading ? (
            <div className="bg-slate-900 border border-slate-900 rounded-xl p-8 text-center text-slate-500 font-medium">
              Cargando bandeja de selección...
            </div>
          ) : filteredAttempts.length === 0 ? (
            <div className="bg-slate-900 border border-slate-900 rounded-xl p-8 text-center text-slate-500 font-medium">
              No se encontraron candidatos con los criterios especificados.
            </div>
          ) : (
            filteredAttempts.map((attempt) => (
              <div 
                key={attempt.id} 
                className="bg-slate-900 border border-slate-900 rounded-xl p-5 flex flex-col gap-4 shadow-md text-left"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-slate-100 text-sm">{attempt.candidateName}</h4>
                    <p className="text-3xs text-slate-500 mt-0.5">{attempt.email}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-3xs font-semibold ring-1 ring-inset ${
                    attempt.riskStatus === 'SAFE'
                      ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
                      : attempt.riskStatus === 'WARNING'
                        ? 'bg-amber-500/10 text-amber-400 ring-amber-500/20'
                        : 'bg-red-500/10 text-red-400 ring-red-500/20'
                  }`}>
                    {attempt.statusLabel}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 bg-slate-950/50 p-3 rounded-lg border border-slate-950/30 text-center text-2xs leading-relaxed">
                  <div>
                    <span className="text-4xs font-bold text-slate-500 uppercase tracking-wider block">Calificación</span>
                    <span className="text-xs font-bold text-indigo-400 font-mono block mt-1">{attempt.overallScore}</span>
                  </div>
                  <div>
                    <span className="text-4xs font-bold text-slate-500 uppercase tracking-wider block">Incidencias</span>
                    <span className="text-xs text-slate-300 font-mono block mt-1">{attempt.incidentsCount}</span>
                  </div>
                  <div>
                    <span className="text-4xs font-bold text-slate-500 uppercase tracking-wider block">Fecha</span>
                    <span className="text-3xs text-slate-400 block mt-1 truncate">{attempt.date.split(',')[0]}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-950/40 pt-3 gap-3">
                  <span className="truncate max-w-[130px] min-[375px]:max-w-[175px] min-[410px]:max-w-[210px] sm:max-w-none block text-left">
                    Prueba: <strong className="text-slate-400 font-medium">{attempt.assessmentTitle.replace('Batería de Evaluación Psicométrica', 'Batería')}</strong>
                  </span>
                  <Link
                    href={`/recruiter/attempts/${attempt.id}`}
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3.5 py-1.5 text-2xs font-bold text-white hover:bg-indigo-500 transition-all cursor-pointer shadow-lg shadow-indigo-600/10 flex-shrink-0"
                  >
                    Ver Reporte
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

      {/* MODAL DE INVITACIÓN A CANDIDATOS */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl relative animate-fade-in flex flex-col gap-5">
            <button
              onClick={() => setIsInviteModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 text-sm cursor-pointer"
            >
              ✕
            </button>
            
            {!generatedInvite ? (
              <form onSubmit={handleSendInvite} className="flex flex-col gap-4 text-left">
                <div>
                  <h3 className="text-base font-bold text-white">Invitar Nuevo Candidato</h3>
                  <p className="text-2xs text-slate-500 mt-0.5">
                    Genera una clave de acceso única para evaluar la integridad y habilidades.
                  </p>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-bold text-slate-500 uppercase tracking-widest">
                    Nombre del Candidato
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nombre completo del candidato"
                    value={inviteForm.candidateName}
                    onChange={(e) => setInviteForm({ ...inviteForm, candidateName: e.target.value })}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-bold text-slate-500 uppercase tracking-widest">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="sofia.valenzuela@example.com"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-3xs font-bold text-slate-500 uppercase tracking-widest">
                    Evaluación Asignada
                  </label>
                  <select
                    value={inviteForm.examId}
                    onChange={(e) => setInviteForm({ ...inviteForm, examId: e.target.value })}
                    disabled={isLoadingExams || availableExams.length === 0}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-600 disabled:opacity-50"
                  >
                    <option value="">{isLoadingExams ? 'Cargando evaluaciones reales...' : 'Selecciona una evaluación'}</option>
                    {availableExams.map((exam) => (
                      <option key={exam.id} value={exam.id}>{exam.title}</option>
                    ))}
                  </select>
                  {(examsError || (!isLoadingExams && availableExams.length === 0)) && (
                    <p className="text-3xs text-amber-400 mt-1">
                      {examsError || 'No hay evaluaciones reales disponibles.'}
                    </p>
                  )}
                </div>

                {inviteError && (
                  <p className="text-2xs text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded">
                    ⚠️ {inviteError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isInviting || !inviteForm.examId}
                  className="w-full mt-2 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isInviting ? 'Generando...' : 'Generar Clave de Acceso'}
                </button>
              </form>
            ) : (
              <div className="flex flex-col gap-4 text-left">
                <div>
                  <span className="text-xl">✅</span>
                  <h3 className="text-base font-bold text-white mt-2">Clave de Acceso Generada</h3>
                  <p className="text-2xs text-slate-500 mt-0.5">
                    Proporciona estas credenciales al candidato para que inicie su examen.
                  </p>
                </div>

                <div className="flex flex-col gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-4xs font-bold text-slate-500 uppercase tracking-widest block">Candidato</span>
                    <span className="text-xs font-semibold text-slate-200 block">{inviteForm.candidateName}</span>
                  </div>
                  
                  <div className="border-t border-slate-900 pt-2.5">
                    <span className="text-4xs font-bold text-slate-500 uppercase tracking-widest block">Clave de Acceso (OTP)</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-mono font-bold text-indigo-400">{generatedInvite.accessCode}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedInvite.accessCode);
                          alert('¡Código copiado al portapapeles!');
                        }}
                        className="text-4xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer underline animate-pulse"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-900 pt-2.5">
                    <span className="text-4xs font-bold text-slate-500 uppercase tracking-widest block">Enlace de Acceso Directo</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-3xs font-mono text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap max-w-[220px]">
                        {window.location.origin + generatedInvite.directLink}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.origin + generatedInvite.directLink);
                          alert('¡Enlace de acceso directo copiado!');
                        }}
                        className="text-4xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer underline flex-shrink-0"
                      >
                        Copiar Enlace
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsInviteModalOpen(false)}
                  className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs cursor-pointer"
                >
                  Entendido / Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      </div>
    </div>
  );
}
