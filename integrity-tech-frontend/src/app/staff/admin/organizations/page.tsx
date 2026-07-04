'use client';

import React, { useEffect, useState } from 'react';
import { AdminShell, StatusBadge } from '../../../../components/staff/AdminShell';
import { apiClient } from '../../../../services/api-client';

type Org = { id: string; name: string; slug: string; domain?: string | null; isActive: boolean; createdAt: string; updatedAt: string; _count?: { users: number; assessments: number; examAttempts: number; candidateInvitations: number } };

export default function OrganizationsPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<Org>('/admin/organization')
      .then((data) => { setOrg(data); setError(null); })
      .catch((err) => setError(err.message || 'No se pudo cargar la organización.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminShell active="Organizaciones" title="Organización" subtitle="Contexto tenant activo. No muestra datos de otras empresas.">
      {error && <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</div>}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        {loading && <p className="text-sm text-slate-400">Cargando organización...</p>}
        {org && <><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-white">{org.name}</h2><p className="mt-1 text-sm text-slate-500">{org.slug}{org.domain ? ` · ${org.domain}` : ''}</p></div><StatusBadge status={org.isActive ? 'ACTIVE' : 'RETIRED'} /></div><div className="mt-6 grid gap-4 md:grid-cols-4"><Metric label="Usuarios" value={org._count?.users || 0} /><Metric label="Evaluaciones" value={org._count?.assessments || 0} /><Metric label="Intentos" value={org._count?.examAttempts || 0} /><Metric label="Invitaciones" value={org._count?.candidateInvitations || 0} /></div></>}
      </section>
    </AdminShell>
  );
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border border-slate-800 bg-slate-950 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-extrabold text-white">{value}</p></div>; }
