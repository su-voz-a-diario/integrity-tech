'use client';

import React, { useEffect, useState } from 'react';
import { AdminShell } from '../../../../components/staff/AdminShell';
import { apiClient } from '../../../../services/api-client';

type AuditEvent = { id: string; action: string; actorType: string; resourceType: string; resourceId?: string | null; createdAt: string; actor?: { email?: string } | null };

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<AuditEvent[]>('/audit/events')
      .then((data) => { setEvents(Array.isArray(data) ? data : []); setError(null); })
      .catch((err) => setError(err.message || 'No se pudo cargar auditoría.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminShell active="Auditoría" title="Auditoría" subtitle="Eventos sensibles del tenant actual. Requiere permiso audit.read.">
      {error && <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</div>}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        {loading ? <p className="text-sm text-slate-400">Cargando eventos...</p> : (
          <div className="flex flex-col gap-3">
            {events.length === 0 && <p className="text-sm text-slate-500">No hay eventos visibles para este usuario.</p>}
            {events.map((event) => (
              <article key={event.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div><p className="text-sm font-bold text-white">{event.action}</p><p className="mt-1 text-xs text-slate-500">{event.resourceType}{event.resourceId ? ` · ${event.resourceId}` : ''}</p></div>
                  <p className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString('es-MX')}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
