'use client';

import React, { useEffect, useState } from 'react';
import { AdminShell } from '../../../components/staff/AdminShell';

type Dependency = {
  name: string;
  status: 'up' | 'down' | 'not_configured';
  latencyMs?: number;
  message?: string;
};

type HealthPayload = {
  status: string;
  uptimeSeconds?: number;
  timestamp?: string;
  dependencies?: Dependency[];
};

const statusTone: Record<string, string> = {
  up: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  ready: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  ok: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  not_configured: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  degraded: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  down: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  not_ready: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
};

export default function StaffSystemPage() {
  const [ready, setReady] = useState<HealthPayload | null>(null);
  const [deps, setDeps] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [readyRes, depsRes] = await Promise.all([
        fetch('/health/ready', { cache: 'no-store' }),
        fetch('/health/dependencies', { cache: 'no-store' }),
      ]);
      const readyJson = await readyRes.json();
      const depsJson = await depsRes.json();
      setReady(readyJson);
      setDeps(depsJson);
      setError(null);
    } catch {
      setError('No se pudo consultar el estado operacional.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AdminShell active="Sistema">
      <div className="flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-slate-800 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-300">Operación Enterprise</p>
            <h1 className="mt-1 text-2xl font-extrabold text-white md:text-3xl">Estado del sistema</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Vista mínima de salud para administradores. No muestra secretos ni datos sensibles.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Actualizar
          </button>
        </header>

        {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>}

        <section className="grid gap-4 md:grid-cols-4">
          <InfoCard label="Readiness" value={ready?.status || 'cargando'} />
          <InfoCard label="Uptime backend" value={ready?.uptimeSeconds ? `${ready.uptimeSeconds}s` : 'sin dato'} />
          <InfoCard label="Backend version" value={process.env.NEXT_PUBLIC_BACKEND_VERSION || '1.0.0'} />
          <InfoCard label="Frontend version" value={process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'} />
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-white">Dependencias</h2>
            <StatusBadge status={deps?.status || 'degraded'} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(deps?.dependencies || []).map((dependency) => (
              <article key={dependency.name} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">{dependency.name}</h3>
                  <StatusBadge status={dependency.status} />
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  {dependency.message || 'Operando normalmente'}
                  {typeof dependency.latencyMs === 'number' ? ` · ${dependency.latencyMs}ms` : ''}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-bold text-white">Entorno</h2>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <Info label="Environment" value={process.env.NEXT_PUBLIC_APP_ENV || 'development'} />
            <Info label="Build date" value={process.env.NEXT_PUBLIC_BUILD_DATE || 'local'} />
            <Info label="Metrics" value="/metrics" />
          </dl>
        </section>
      </div>
    </AdminShell>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-200">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-md border px-2 py-1 text-xs font-bold ${statusTone[status] || statusTone.degraded}`}>
      {status}
    </span>
  );
}
