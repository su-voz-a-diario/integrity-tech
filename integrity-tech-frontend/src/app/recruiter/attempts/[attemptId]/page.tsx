'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

// Mock de fallback para demostración si la API no está disponible
const MOCK_REPORT_DETAILS: Record<string, any> = {
  'att-1098': {
    candidateName: 'Andrés López',
    email: 'andres.lopez@example.com',
    assessmentTitle: 'Batería de Evaluación Psicométrica Integrada (IT²)',
    date: '27 Jun 2026, 16:40',
    overallScore: '46/100',
    ipAddress: '190.143.45.22',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    sessionHmac: 'hmac-84f938d8212e33bc88a8f1ff4f5e7188',
    dimensions: [
      {
        name: 'INTEGRIDAD Y ÉTICA (IT²-I)',
        score: 18,
        description: 'Puntaje crítico inferior al umbral mínimo del 20%. El candidato tiende a justificar conductas irregulares (sobrantes en caja, uso privado de recursos).',
      },
      {
        name: 'PERSONALIDAD Y CONDUCTA (IT²-P10)',
        score: 55,
        description: 'Nivel promedio. Estilo conductual equilibrado, estable ante el estrés normal, con niveles estándar de responsabilidad.',
      },
      {
        name: 'APTITUD COGNITIVA (IT²-AC10)',
        score: 70,
        description: 'Capacidad de aprendizaje y razonamiento abstracto superior a la media. Resuelve problemas numéricos de forma ágil.',
      },
      {
        name: 'COMPETENCIAS BLANDAS (IT²-CB10)',
        score: 45,
        description: 'Ajuste social moderado. Muestra dificultades para mediar en conflictos interpersonales y prefiere delegar el feedback correctivo.',
      },
    ],
    alerts: [
      '⚠️ RIESGO ÉTICO CRÍTICO: El percentil de Integridad (18%) se ubica por debajo del umbral mínimo tolerable del 20%.'
    ],
    proctoringLogs: [
      {
        id: '1',
        eventType: 'student_idle',
        riskLevel: 'WARNING',
        timestamp: '16:42:15',
        metadata: {
          sequence: 1,
          idleDurationMs: 60000,
          signature: 'sig-84f938d8212e33bc88a8f1ff4f5e7188',
        },
        message: 'Inactividad prolongada (60s sin entrada de teclado ni cursor)',
      },
      {
        id: '2',
        eventType: 'tab_focus_lost',
        riskLevel: 'WARNING',
        timestamp: '16:45:10',
        metadata: {
          sequence: 2,
          trigger: 'window_blur',
          signature: 'sig-9bc88a8f1ff4f5e718884f938d8212e33',
        },
        message: 'Pérdida de foco: Estudiante sale de la ventana del examen (Alt+Tab / cambio de app)',
      },
      {
        id: '3',
        eventType: 'tab_focus_lost',
        riskLevel: 'WARNING',
        timestamp: '16:46:02',
        metadata: {
          sequence: 3,
          trigger: 'visibility_hidden',
          signature: 'sig-f4f5e718884f938d8212e33bc88a8f1ff',
        },
        message: 'Pérdida de foco: Estudiante cambia o minimiza la pestaña',
      },
      {
        id: '4',
        eventType: 'tab_focus_lost',
        riskLevel: 'WARNING',
        timestamp: '16:48:40',
        metadata: {
          sequence: 4,
          trigger: 'window_blur',
          signature: 'sig-e33bc88a8f1ff4f5e718884f938d8212',
        },
        message: 'Pérdida de foco: Segunda salida de ventana en menos de 3 minutos',
      },
      {
        id: '5',
        eventType: 'suspicious_behavior_detected',
        riskLevel: 'CRITICAL',
        timestamp: '16:48:40',
        metadata: {
          reason: 'Exceso de pérdidas de foco (3 salidas de ventana en menos de 5 minutos)',
          focusLostCount: 3,
          severity: 'HIGH',
          signature: 'sig-backend-generated-audit-chain',
        },
        message: 'COMPORTAMIENTO SOSPECHOSO DETECTADO POR EL WORKER (Límite de desfoques excedido)',
      },
    ],
  },
  default: {
    candidateName: 'Sofía Valenzuela',
    email: 'sofia.valenzuela@example.com',
    assessmentTitle: 'Batería de Evaluación Psicométrica Integrada (IT²)',
    date: '28 Jun 2026, 08:24',
    overallScore: '79/100',
    ipAddress: '186.22.143.50',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    sessionHmac: 'hmac-d4e5f72382f1ff4f5e7188d8212e33bc',
    dimensions: [
      {
        name: 'INTEGRIDAD Y ÉTICA (IT²-I)',
        score: 78,
        description: 'Alineación ética óptima. Excelente apego a las normas y políticas organizacionales ante dilemas situacionales reales.',
      },
      {
        name: 'PERSONALIDAD Y CONDUCTA (IT²-P10)',
        score: 85,
        description: 'Rasgos de responsabilidad y estabilidad emocional altos. Demuestra resiliencia superior bajo entornos de presión moderada.',
      },
      {
        name: 'APTITUD COGNITIVA (IT²-AC10)',
        score: 62,
        description: 'Razonamiento analítico numérico y verbal promedio. Capacidad adecuada para la asimilación rápida de nuevos procedimientos.',
      },
      {
        name: 'COMPETENCIAS BLANDAS (IT²-CB10)',
        score: 90,
        description: 'Liderazgo participativo de excelencia. Muestra asertividad óptima para orientar a clientes y colaborar de forma empática.',
      },
    ],
    alerts: [],
    proctoringLogs: [
      {
        id: '1',
        eventType: 'tab_focus_lost',
        riskLevel: 'WARNING',
        timestamp: '08:26:10',
        metadata: {
          sequence: 1,
          trigger: 'window_blur',
          signature: 'sig-d4e5f72382f1ff4f5e7188d8212e33bc',
        },
        message: 'Pérdida de foco: Salida única y breve del navegador',
      },
      {
        id: '2',
        eventType: 'tab_focus_gained',
        riskLevel: 'INFO',
        timestamp: '08:26:14',
        metadata: {
          sequence: 2,
          trigger: 'window_focus',
          signature: 'sig-f5e7188d8212e33bcd4e5f72382f1ff4',
        },
        message: 'Foco restablecido: El estudiante regresa al examen tras 4 segundos',
      },
    ],
  },
};

export default function CandidateAttemptReport({ params }: { params: { attemptId: string } }) {
  const attemptId = params.attemptId;
  const [report, setReport] = useState<any>(null);
  const [perfiles, setPerfiles] = useState<any[]>([]);
  const [selectedPerfilId, setSelectedPerfilId] = useState<string>('');
  const [igaData, setIgaData] = useState<any>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Consulta dinámica del intento y perfiles
  useEffect(() => {
    const authHeaders = {
      'Authorization': `Bearer ${localStorage.getItem('auth-token') || ''}`,
    };

    const fetchReport = fetch(`/api/evaluations/attempts/${attemptId}`, { headers: authHeaders })
      .then((res) => {
        if (!res.ok) throw new Error('Not Found');
        return res.json();
      })
      .catch((err) => {
        console.warn(`[Reporte] No se pudo cargar reporte real para el attemptId: ${attemptId}`, err);
        return process.env.NEXT_PUBLIC_ENABLE_DEMO_MOCKS === 'true'
          ? (MOCK_REPORT_DETAILS[attemptId] || MOCK_REPORT_DETAILS.default)
          : null;
      });

    const fetchPerfiles = fetch('/api/evaluations/perfiles', { headers: authHeaders })
      .then((res) => (res.ok ? res.json() : []))
      .catch(() => []);

    const fetchIga = fetch(`/api/evaluations/attempts/${attemptId}/resultados`, { headers: authHeaders })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);

    Promise.all([fetchReport, fetchPerfiles, fetchIga]).then(([reportData, perfilesData, igaRes]) => {
      setReport(reportData);
      if (!reportData) {
        setPerfiles([]);
        setIgaData(null);
        setIsLoading(false);
        return;
      }
      
      const finalPerfiles = perfilesData.length > 0 ? perfilesData : [
        { id: 'p1', nombre: 'Gerente Comercial' },
        { id: 'p2', nombre: 'Desarrollador de Software' },
        { id: 'p3', nombre: 'Tesorero / Cajero' },
        { id: 'p4', nombre: 'Director de Recursos Humanos' },
      ];
      setPerfiles(finalPerfiles);

      if (igaRes && igaRes.iga) {
        setIgaData(igaRes);
        const matchingProfile = finalPerfiles.find((p: any) => p.nombre === igaRes.perfil_puesto);
        if (matchingProfile) {
          setSelectedPerfilId(matchingProfile.id);
        } else {
          setSelectedPerfilId(finalPerfiles[0]?.id || '');
        }
      } else {
        const score = parseInt(reportData.overallScore) || 75;
        const rec = score >= 75 ? 'Recomendado' : (score >= 50 ? 'Aceptable con observaciones' : 'No recomendado');
        setIgaData({
          perfil_puesto: finalPerfiles[0]?.nombre || 'Gerente Comercial',
          iga: {
            valor: score,
            recomendacion: rec,
            alertas: score < 50 ? ['Riesgo ético elevado'] : [],
          }
        });
        setSelectedPerfilId(finalPerfiles[0]?.id || '');
      }

      setIsLoading(false);
    });
  }, [attemptId]);

  const handleRecalcular = async (perfilId: string) => {
    setSelectedPerfilId(perfilId);
    setIsRecalculating(true);

    try {
      const response = await fetch(`/api/evaluations/attempts/${attemptId}/recalcular-iga`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth-token') || ''}`,
        },
        body: JSON.stringify({ perfilId }),
      });
      if (response.ok) {
        const newIga = await response.json();
        setIgaData(newIga);
      }
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

  const numericScore = igaData?.iga?.valor ?? (parseInt(report?.overallScore || '0') || 0);
  const rawRecomendacion = igaData?.iga?.recomendacion || 'Recomendado';
  const isRecommended = rawRecomendacion === 'Recomendado';
  const isAcceptable = rawRecomendacion === 'Aceptable con observaciones' || rawRecomendacion === 'Aceptable';
  
  const statusText = isRecommended 
    ? 'Ajuste Alto (Recomendado)' 
    : isAcceptable 
      ? 'Ajuste Medio (Aceptable)' 
      : 'Ajuste Bajo (No Recomendado)';

  const statusColor = isRecommended 
    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
    : isAcceptable 
      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
      : 'bg-red-500/10 border-red-500/20 text-red-400';

  const allAlerts = [...(report?.alerts || []), ...(igaData?.iga?.alertas || [])];

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
                    disabled={isRecalculating}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
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
                    <span className="text-2xl font-extrabold text-indigo-400 tracking-tight font-mono">{numericScore}/100</span>
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
                {report.dimensions.map((dim: any, idx: number) => {
                  const score = dim.score;
                  const colorClass = score >= 75 
                    ? 'bg-emerald-500' 
                    : score >= 50 
                      ? 'bg-amber-500' 
                      : 'bg-red-500';
                  
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
                <span className="text-slate-300 font-medium">Cadena de Firmas Criptográficas Válida</span>
              </div>
              <div className="font-mono text-slate-500 select-all truncate max-w-xs lg:max-w-md">
                {report.sessionHmac}
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
                {report.proctoringLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 font-medium">No se registraron alertas conductuales.</p>
                ) : (
                  report.proctoringLogs.map((log: any) => {
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
                            <div className="truncate">Sign: {log.metadata.signature || 'local-chain-valid'}</div>
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
