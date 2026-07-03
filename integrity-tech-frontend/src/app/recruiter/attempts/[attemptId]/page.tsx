'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '../../../../services/api-client';
import type { AttemptReportResponse, AttemptResultadosResponse, PerfilPuesto } from '../../../../generated/api/types';

export default function CandidateAttemptReport({ params }: { params: { attemptId: string } }) {
  const attemptId = params.attemptId;
  const [report, setReport] = useState<AttemptReportResponse | null>(null);
  const [perfiles, setPerfiles] = useState<PerfilPuesto[]>([]);
  const [selectedPerfilId, setSelectedPerfilId] = useState<string>('');
  const [igaData, setIgaData] = useState<any>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Consulta dinámica del intento y perfiles
  useEffect(() => {
    const fetchReport = apiClient.get<AttemptReportResponse>(`/evaluations/attempts/${attemptId}`)
      .catch((err) => {
        console.warn(`[Reporte] No se pudo cargar reporte real para el attemptId: ${attemptId}`, err);
        return null;
      });

    const fetchPerfiles = apiClient.get<PerfilPuesto[]>('/evaluations/perfiles')
      .catch(() => []);

    const fetchIga = apiClient.get<AttemptResultadosResponse>(`/evaluations/attempts/${attemptId}/resultados`)
      .catch(() => null);

    Promise.all([fetchReport, fetchPerfiles, fetchIga]).then(([reportData, perfilesData, igaRes]) => {
      setReport(reportData);
      if (!reportData) {
        setPerfiles([]);
        setIgaData(null);
        setIsLoading(false);
        return;
      }
      
      const finalPerfiles = Array.isArray(perfilesData) ? perfilesData : [];
      setPerfiles(finalPerfiles);

      if (igaRes && igaRes.iga) {
        setIgaData(igaRes);
        const matchingProfile = finalPerfiles.find((p: any) => p.nombre === igaRes.perfil_puesto);
        setSelectedPerfilId(matchingProfile?.id || finalPerfiles[0]?.id || '');
      } else {
        setIgaData(null);
        setSelectedPerfilId(finalPerfiles[0]?.id || '');
      }

      setIsLoading(false);
    });
  }, [attemptId]);

  const handleRecalcular = async (perfilId: string) => {
    if (!perfilId) return;
    setSelectedPerfilId(perfilId);
    setIsRecalculating(true);

    try {
      const newIga = await apiClient.post<AttemptResultadosResponse>(`/evaluations/attempts/${attemptId}/recalcular-iga`, { perfilId });
      setIgaData(newIga);
    } catch (err) {
      console.error('Error recalcular IGA:', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-sm text-slate-500 font-medium">Cargando reporte de evaluación...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
          <h1 className="text-lg font-bold text-white">Reporte no disponible</h1>
          <p className="text-sm text-slate-400 mt-2">No hay datos reales disponibles para este intento o tu sesión no tiene permisos.</p>
          <Link href="/recruiter/dashboard" className="inline-flex mt-5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold">
            Volver al dashboard
          </Link>
        </div>
      </div>
    );
  }

  const numericScore = typeof igaData?.iga?.valor === 'number' ? igaData.iga.valor : null;
  const rawRecomendacion = typeof igaData?.iga?.recomendacion === 'string' ? igaData.iga.recomendacion : '';
  const isRecommended = rawRecomendacion === 'Recomendado';
  const isAcceptable = rawRecomendacion === 'Aceptable con observaciones' || rawRecomendacion === 'Aceptable';
  
  const statusText = rawRecomendacion || 'Sin resultado IGA disponible';

  const statusColor = !rawRecomendacion
    ? 'bg-slate-950 border-slate-800 text-slate-400'
    : isRecommended 
      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
      : isAcceptable 
        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
        : 'bg-red-500/10 border-red-500/20 text-red-400';

  const allAlerts = [...(report?.alerts || []), ...(igaData?.iga?.alertas || [])];
  const reportDimensions = report.dimensions || [];
  const reportProctoringLogs = report.proctoringLogs || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* ENCABEZADO DE NAVEGACION */}
        <div className="flex items-center gap-4">
          <Link
            href="/recruiter/dashboard"
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Reporte de Evaluación</h1>
            <p className="text-xs text-slate-500">ID del Intento: {attemptId}</p>
          </div>
        </div>

        {/* DISEÑO EN DOS COLUMNAS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUMNA IZQUIERDA: PERFIL PSICOMÉTRICO (Ancho 2/3) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* CARD PRINCIPAL CANDIDATO */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col gap-6 shadow-md">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white leading-tight">{report.candidateName}</h2>
                  <p className="text-xs text-slate-400 mt-1">{report.email}</p>
                </div>

                {/* Selección de Perfil para Recalcular */}
                <div className="flex flex-col gap-1 w-full md:w-auto">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Perfil del Cargo</label>
                  <select
                    value={selectedPerfilId}
                    onChange={(e) => handleRecalcular(e.target.value)}
                    disabled={isRecalculating || perfiles.length === 0}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer disabled:opacity-50"
                  >
                    {perfiles.length === 0 && <option value="">Sin perfiles reales disponibles</option>}
                    {perfiles.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-800/60 pt-5">
                {/* Panel 1: Info del Examen */}
                <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Batería Asignada</p>
                  <p className="text-xs font-semibold text-indigo-400 mt-1.5">{report.assessmentTitle}</p>
                </div>

                {/* Panel 2: Semáforo / Adecuación */}
                <div className={`border p-4 rounded-xl flex flex-col justify-center ${statusColor}`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Adecuación al Puesto</p>
                  <p className="text-xs font-bold mt-1.5">{statusText}</p>
                </div>

                {/* Panel 3: Índice IGA Global */}
                <div className="bg-indigo-950/20 border border-indigo-900/40 p-4 rounded-xl flex flex-col justify-center relative overflow-hidden">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Índice IGA</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Puntaje ponderado</p>
                    </div>
                    <span className="text-2xl font-extrabold text-indigo-400 tracking-tight font-mono">{numericScore !== null ? `${numericScore}/100` : 'N/D'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ALERTAS CRÍTICAS DE BAREMACIÓN */}
            {allAlerts.length > 0 && (
              <div className="flex flex-col gap-2.5 bg-red-950/20 border border-red-900/40 p-4 rounded-xl text-xs text-red-400 font-medium">
                {allAlerts.map((alert: string, aIdx: number) => (
                  <div key={aIdx} className="flex items-start gap-2">
                    <span>⚠️</span>
                    <span>{alert}</span>
                  </div>
                ))}
              </div>
            )}

            {/* DIMENSIONES PSICOMÉTRICAS */}
            <div className="bg-slate-900 border border-slate-900 p-6 rounded-xl flex flex-col gap-6 shadow-md">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Desglose Psicométrico</h3>
                <p className="text-xs text-slate-500 mt-1">Barras de afinidad por dimensiones del perfil conductual.</p>
              </div>

              <div className="space-y-6">
                {reportDimensions.map((dim: any, idx: number) => {
                  const score = dim.score;
                  const colorClass = 'bg-indigo-500';
                  
                  return (
                    <div key={idx} className="flex flex-col gap-2">
                      <div className="flex justify-between items-center text-sm font-semibold">
                        <span className="text-slate-200 tracking-wide">{dim.name}</span>
                        <span className="text-slate-100 font-mono">{score}%</span>
                      </div>
                      
                      <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-900/50">
                        <div
                          className={`h-full ${colorClass} transition-all duration-500`}
                          style={{ width: `${score}%` }}
                        />
                      </div>

                      <p className="text-xs text-slate-400 leading-relaxed mt-1 font-light">
                        {dim.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AUDITORÍA DE FIRMAS HMAC */}
            <div className="bg-slate-900 border border-slate-900 p-4 rounded-xl flex items-center justify-between shadow-md text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-300 font-medium">Cadena de Firmas Registrada</span>
              </div>
              <div className="font-mono text-slate-500 select-all truncate max-w-xs lg:max-w-md">
                {report.sessionHmac || 'No disponible'}
              </div>
            </div>

          </div>

          {/* COLUMNA DERECHA: AUDIT TRAIL / PROCTORING TIMELINE (Ancho 1/3) */}
          <div className="flex flex-col gap-6">
            
            {/* INFO ADICIONAL SESION */}
            <div className="bg-slate-900 border border-slate-900 p-6 rounded-xl shadow-md">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Detalles del Intento</h3>
              <div className="space-y-3 text-xs leading-relaxed">
                <div className="flex justify-between">
                  <span className="text-slate-500">Fecha Sesión:</span>
                  <span className="text-slate-300 font-semibold">{report.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dirección IP:</span>
                  <span className="text-slate-300 font-mono font-semibold">{report.ipAddress}</span>
                </div>
                <div className="flex flex-col gap-1 border-t border-slate-950 pt-3">
                  <span className="text-slate-500">Entorno Navegador:</span>
                  <span className="text-2xs text-slate-400 font-medium break-all">{report.userAgent}</span>
                </div>
              </div>
            </div>

            {/* TIMELINE DE PROCTORING */}
            <div className="bg-slate-900 border border-slate-900 p-6 rounded-xl flex flex-col gap-6 shadow-md flex-1">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Bitácora de Proctoring</h3>
                <p className="text-2xs text-slate-500 mt-1">Línea de tiempo de telemetría del navegador.</p>
              </div>

              {/* Contenedor del timeline vertical */}
              <div className="relative border-l border-slate-800 pl-4 space-y-6">
                {reportProctoringLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 font-medium">No se registraron alertas conductuales.</p>
                ) : (
                  reportProctoringLogs.map((log: any) => {
                    const isCritical = log.riskLevel === 'CRITICAL';
                    const isWarning = log.riskLevel === 'WARNING';
                    
                    const dotColorClass = isCritical
                      ? 'bg-red-500 ring-red-500/20'
                      : isWarning
                        ? 'bg-amber-500 ring-amber-500/20'
                        : 'bg-slate-700 ring-slate-700/20';

                    return (
                      <div key={log.id} className="relative group">
                        <span className={`absolute -left-6.5 top-1.5 flex h-2.5 w-2.5 items-center justify-center rounded-full ${dotColorClass} ring-4`} />
                        
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-[10px] sm:text-2xs gap-0.5 sm:gap-2 text-left w-full">
                            <span className={`font-semibold tracking-wide block ${
                              isCritical 
                                ? 'text-red-400' 
                                : isWarning 
                                  ? 'text-amber-400' 
                                  : 'text-slate-400'
                            }`}>
                              {log.eventType.toUpperCase()}
                            </span>
                            <span className="text-slate-500 font-mono block sm:inline">{log.timestamp}</span>
                          </div>
                          
                          <p className="text-xs text-slate-300 font-light leading-relaxed">
                            {log.message}
                          </p>

                          {log.eventType === 'identity_snapshot' && (
                            <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950 p-2 text-3xs text-slate-500">
                              Captura facial no expuesta en reporte. Solo metadata registrada.
                            </div>
                          )}

                          <div className="mt-1 font-mono text-3xs text-slate-500 flex flex-col gap-0.5 bg-slate-950 p-2 rounded border border-slate-900/50">
                            <div>Seq: {log.metadata.sequence || '1'}</div>
                            {log.metadata.trigger && <div>Trig: {log.metadata.trigger}</div>}
                            {log.metadata.idleDurationMs && <div>Idle: {log.metadata.idleDurationMs}ms</div>}
                            <div className="truncate">Sign: {log.metadata.signature || 'No registrada'}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
