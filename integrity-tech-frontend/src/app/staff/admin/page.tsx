'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { AdminShell, StatusBadge } from '../../../components/staff/AdminShell';
import { apiClient, ApiClientError } from '../../../services/api-client';

type Assessment = { id: string; name: string; status: string; versions?: Array<{ id: string; status: string }> };
type Item = { id: string; status: string; versions?: Array<{ id: string; status: string }> };
type Exam = { id: string; title: string };
type Attempt = { id: string; status?: string; candidateName?: string; assessmentTitle?: string };
type AuditEvent = { id: string; action: string; createdAt: string; actorType: string; resourceType: string };

export default function AdminDashboardPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [assessmentData, itemData, examData, attemptData, auditData] = await Promise.allSettled([
          apiClient.get<Assessment[]>('/psychometric-governance/assessments'),
          apiClient.get<Item[]>('/psychometric-governance/items'),
          apiClient.get<Exam[]>('/exams'),
          apiClient.get<Attempt[]>('/evaluations/attempts'),
          apiClient.get<AuditEvent[]>('/audit/events'),
        ]);
        if (!mounted) return;
        if (assessmentData.status === 'fulfilled') setAssessments(Array.isArray(assessmentData.value) ? assessmentData.value : []);
        if (itemData.status === 'fulfilled') setItems(Array.isArray(itemData.value) ? itemData.value : []);
        if (examData.status === 'fulfilled') setExams(Array.isArray(examData.value) ? examData.value : []);
        if (attemptData.status === 'fulfilled') setAttempts(Array.isArray(attemptData.value) ? attemptData.value : []);
        if (auditData.status === 'fulfilled') setEvents(Array.isArray(auditData.value) ? auditData.value.slice(0, 8) : []);
        const rejected = [assessmentData, itemData, examData, attemptData, auditData].find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
        setError(rejected?.reason instanceof ApiClientError ? rejected.reason.message : null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const metrics = useMemo(() => {
    const versions = assessments.flatMap((assessment) => assessment.versions || []);
    return {
      published: exams.length,
      drafts: assessments.filter((assessment) => assessment.status === 'DRAFT').length,
      versions: versions.length,
      items: items.length,
      activeInvitations: attempts.filter((attempt) => attempt.status === 'INVITED').length,
      attempts: attempts.length,
    };
  }, [assessments, attempts, exams.length, items.length]);

  return (
    <AdminShell active="Dashboard" title="Dashboard Administrativo" subtitle="Operación central del producto con datos reales del tenant actual.">
      {error && <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</div>}
      {loading && <div className="rounded-lg border border-slate-800 bg-slate-900 p-5 text-sm text-slate-300">Cargando datos administrativos...</div>}

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Publicadas" value={metrics.published} />
        <Metric label="Borradores" value={metrics.drafts} />
        <Metric label="Versiones" value={metrics.versions} />
        <Metric label="Reactivos" value={metrics.items} />
        <Metric label="Invitaciones activas" value={metrics.activeInvitations} />
        <Metric label="Intentos" value={metrics.attempts} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-white">Evaluaciones recientes</h2>
            <Link href="/staff/admin/evaluations" className="text-xs font-semibold text-indigo-300 hover:text-indigo-200">Abrir módulo</Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500"><tr><th className="py-2">Evaluación</th><th className="py-2">Estado</th><th className="py-2">Versiones</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {assessments.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-slate-500">No hay evaluaciones creadas.</td></tr>}
                {assessments.slice(0, 8).map((assessment) => (
                  <tr key={assessment.id}><td className="py-3 font-semibold text-slate-100">{assessment.name}</td><td className="py-3"><StatusBadge status={assessment.status} /></td><td className="py-3 text-slate-400">{assessment.versions?.length || 0}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-bold text-white">Actividad reciente</h2>
          <div className="mt-4 flex flex-col gap-3">
            {events.length === 0 && <p className="text-sm text-slate-500">Sin eventos visibles para tu permiso actual.</p>}
            {events.map((event) => (
              <article key={event.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <p className="text-sm font-bold text-slate-100">{event.action}</p>
                <p className="mt-1 text-xs text-slate-500">{event.resourceType} · {new Date(event.createdAt).toLocaleString('es-MX')}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-white">{value}</p>
    </div>
  );
}
