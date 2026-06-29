'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

// Mock de fallback para demostración si la API no responde
const MOCK_ATTEMPTS = [
  {
    id: 'att-9876',
    candidateName: 'Sofía Valenzuela',
    email: 'sofia.valenzuela@example.com',
    assessmentTitle: 'Evaluación de Honestidad y Valores v2',
    date: '28 Jun 2026, 08:24',
    overallScore: '92/100',
    incidentsCount: 0,
    riskStatus: 'SAFE',
    statusLabel: 'Sin alertas',
  },
  {
    id: 'att-5432',
    candidateName: 'Carlos Mendoza',
    email: 'carlos.mendoza@example.com',
    assessmentTitle: 'Perfil Psicométrico Conductual',
    date: '28 Jun 2026, 07:15',
    overallScore: '74/100',
    incidentsCount: 2,
    riskStatus: 'WARNING',
    statusLabel: 'Sospechoso',
  },
  {
    id: 'att-1098',
    candidateName: 'Andrés López',
    email: 'andres.lopez@example.com',
    assessmentTitle: 'Evaluación de Honestidad y Valores v2',
    date: '27 Jun 2026, 16:40',
    overallScore: '48/100',
    incidentsCount: 6,
    riskStatus: 'CRITICAL',
    statusLabel: 'Fraude probable',
  },
  {
    id: 'att-4321',
    candidateName: 'Mariana Herrera',
    email: 'mariana.herrera@example.com',
    assessmentTitle: 'Perfil Psicométrico Conductual',
    date: '27 Jun 2026, 14:10',
    overallScore: '85/100',
    incidentsCount: 1,
    riskStatus: 'SAFE',
    statusLabel: 'Sin alertas',
  },
];

export default function RecruiterDashboard() {
  const [filter, setFilter] = useState<'ALL' | 'SAFE' | 'WARNING' | 'CRITICAL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [attempts, setAttempts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Carga asíncrona de datos desde la API
  useEffect(() => {
    fetch('/api/evaluations/attempts')
      .then((res) => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then((data) => {
        setAttempts(Array.isArray(data) ? data : []);
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn('[Dashboard] Fallback a mocks locales debido a inactividad del backend:', err);
        setAttempts(MOCK_ATTEMPTS);
        setIsLoading(false);
      });
  }, []);

  // Filtrado de candidatos basado en las interacciones
  const filteredAttempts = attempts.filter((attempt) => {
    const matchesFilter = filter === 'ALL' || attempt.riskStatus === filter;
    const matchesSearch = attempt.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          attempt.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* ENCABEZADO */}
        <div className="flex justify-between items-start border-b border-slate-900 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Consola de Selección</h1>
            <p className="text-sm text-slate-400 mt-1">
              Monitoreo de perfiles psicométricos y auditoría de integridad conductual (Proctoring).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">Empresa:</span>
            <span className="px-3 py-1 bg-slate-900 border border-slate-800 text-xs font-semibold rounded-lg text-indigo-400">
              Integrity-Tech Corp
            </span>
          </div>
        </div>

        {/* METRICAS RAPIDAS (KPI CARDS) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-900 p-6 rounded-xl shadow-md">
            <p className="text-2xs font-bold text-slate-500 uppercase tracking-widest">Total Evaluados</p>
            <h3 className="text-3xl font-bold text-slate-100 mt-2">1,248</h3>
            <p className="text-2xs text-slate-400 mt-2">
              <span className="text-emerald-500 font-semibold">↑ 12%</span> respecto a la semana anterior
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-900 p-6 rounded-xl shadow-md">
            <p className="text-2xs font-bold text-slate-500 uppercase tracking-widest">Índice de Integridad</p>
            <h3 className="text-3xl font-bold text-slate-100 mt-2">78.4%</h3>
            <p className="text-2xs text-slate-400 mt-2">
              Promedio de coincidencia con perfiles de confianza
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-900 p-6 rounded-xl shadow-md border-r-amber-500/20">
            <p className="text-2xs font-bold text-slate-500 uppercase tracking-widest text-amber-500">Alertas Críticas</p>
            <h3 className="text-3xl font-bold text-amber-500 mt-2">12</h3>
            <p className="text-2xs text-slate-400 mt-2">
              Candidatos sospechosos de manipulación en las últimas 24h
            </p>
          </div>
        </div>

        {/* FILTROS Y CONTROLES */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900/40 p-4 border border-slate-900 rounded-xl">
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Buscar candidato o correo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-4 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
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
                  className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
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
        </div>

        {/* LISTADO DE CANDIDATOS */}
        <div className="bg-slate-900/30 border border-slate-900 rounded-xl overflow-hidden shadow-lg">
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

      </div>
    </div>
  );
}
