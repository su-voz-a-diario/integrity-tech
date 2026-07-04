'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { AdminShell, StatusBadge } from '../../../../components/staff/AdminShell';
import { apiClient } from '../../../../services/api-client';

type Assessment = { id: string; code: string; name: string; status: string; versions?: Array<{ id: string; version: string; status: string; publishedAt?: string | null; retiredAt?: string | null }> };

export default function PublicationsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<Assessment[]>('/psychometric-governance/assessments')
      .then((data) => { setAssessments(Array.isArray(data) ? data : []); setError(null); })
      .catch((err) => setError(err.message || 'No se pudieron cargar publicaciones.'))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => assessments.flatMap((assessment) => (assessment.versions || []).map((version) => ({ assessment, version }))), [assessments]);

  return (
    <AdminShell active="Publicaciones" title="Publicaciones" subtitle="Control de versiones publicadas, aprobadas y retiradas. Publicar una AssessmentVersion materializa automáticamente el Exam para reclutamiento.">
      {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        {loading ? <p className="text-sm text-slate-400">Cargando publicaciones...</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500"><tr><th className="py-3">Evaluación</th><th className="py-3">Versión</th><th className="py-3">Estado</th><th className="py-3">Publicación</th><th className="py-3 text-right">Acción</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {rows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-500">No hay versiones editoriales.</td></tr>}
                {rows.map(({ assessment, version }) => (
                  <tr key={version.id}>
                    <td className="py-3 font-semibold text-slate-100">{assessment.name}<p className="text-xs font-normal text-slate-500">{assessment.code}</p></td>
                    <td className="py-3 text-slate-300">v{version.version}</td>
                    <td className="py-3"><StatusBadge status={version.status} /></td>
                    <td className="py-3 text-slate-400">{version.publishedAt ? new Date(version.publishedAt).toLocaleString('es-MX') : 'Sin publicar'}</td>
                    <td className="py-3 text-right"><Link href={`/staff/admin/evaluations/versions/${version.id}`} className="text-xs font-semibold text-indigo-300 hover:text-indigo-200">Abrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
