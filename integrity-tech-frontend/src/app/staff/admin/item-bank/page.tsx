'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { AdminShell, StatusBadge } from '../../../../components/staff/AdminShell';
import { apiClient, ApiClientError } from '../../../../services/api-client';

type ItemVersion = { id: string; version: string; status: string; language?: string; difficulty?: number | null; discrimination?: number | null };
type Item = {
  id: string;
  itemCode: string;
  status: string;
  category?: { name: string } | null;
  competency?: { name: string } | null;
  scale?: { name: string } | null;
  subscale?: { name: string } | null;
  versions?: ItemVersion[];
};

const initialStem = JSON.stringify({ type: 'LIKERT', prompt: 'Escribe el contenido del reactivo', options: [1, 2, 3, 4, 5] }, null, 2);

export default function ItemBankPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ itemCode: '', category: '', competency: '', scale: '', subscale: '', stemJson: initialStem });

  async function load() {
    setLoading(true);
    try {
      const data = await apiClient.get<Item[]>('/psychometric-governance/items');
      setItems(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err: any) {
      setError(err instanceof ApiClientError ? err.message : err.message || 'No se pudo cargar el banco de reactivos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createItem(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const stemJson = JSON.parse(form.stemJson);
      await apiClient.post('/psychometric-governance/items', {
        itemCode: form.itemCode.trim(),
        category: form.category.trim() || undefined,
        competency: form.competency.trim() || undefined,
        scale: form.scale.trim() || undefined,
        subscale: form.subscale.trim() || undefined,
        stemJson,
      });
      setNotice('Reactivo creado con versión inicial DRAFT.');
      setForm({ itemCode: '', category: '', competency: '', scale: '', subscale: '', stemJson: initialStem });
      await load();
    } catch (err: any) {
      setError(err instanceof SyntaxError ? 'El JSON del reactivo no es válido.' : err.message || 'No se pudo crear el reactivo.');
    } finally {
      setCreating(false);
    }
  }

  const filtered = useMemo(() => items.filter((item) => {
    const text = [item.itemCode, item.category?.name, item.competency?.name, item.scale?.name, item.subscale?.name].filter(Boolean).join(' ').toLowerCase();
    const matchesQuery = !query || text.includes(query.toLowerCase());
    const matchesStatus = status === 'ALL' || item.status === status || (item.versions || []).some((version) => version.status === status);
    return matchesQuery && matchesStatus;
  }), [items, query, status]);

  return (
    <AdminShell active="Banco de Reactivos" title="Banco de Reactivos" subtitle="Creación, clasificación, búsqueda y versionado de reactivos con datos reales del tenant.">
      {notice && <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div>}
      {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>}

      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form onSubmit={createItem} className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-bold text-white">Crear reactivo</h2>
          <p className="mt-1 text-xs text-slate-500">Se crea un Item y una ItemVersion DRAFT; no se publica automáticamente.</p>
          <Field label="Código" value={form.itemCode} onChange={(value) => setForm({ ...form, itemCode: value })} required />
          <Field label="Dimensión" value={form.category} onChange={(value) => setForm({ ...form, category: value })} />
          <Field label="Competencia" value={form.competency} onChange={(value) => setForm({ ...form, competency: value })} />
          <Field label="Escala" value={form.scale} onChange={(value) => setForm({ ...form, scale: value })} />
          <Field label="Subescala" value={form.subscale} onChange={(value) => setForm({ ...form, subscale: value })} />
          <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-slate-500">Contenido JSON</label>
          <textarea value={form.stemJson} onChange={(event) => setForm({ ...form, stemJson: event.target.value })} className="mt-2 min-h-48 w-full rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200 outline-none focus:border-indigo-400" />
          <button disabled={creating || !form.itemCode.trim()} className="mt-4 w-full rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-100 hover:border-emerald-300 disabled:opacity-50">
            {creating ? 'Creando...' : 'Crear reactivo'}
          </button>
        </form>

        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-bold text-white">Reactivos</h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por código, dimensión o competencia" className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-indigo-400">
                {['ALL', 'DRAFT', 'INTERNAL_REVIEW', 'PSYCHOLOGIST_REVIEW', 'APPROVED', 'PUBLISHED', 'ACTIVE', 'RETIRED'].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {loading && <p className="text-sm text-slate-400">Cargando reactivos...</p>}
            {!loading && filtered.length === 0 && <p className="text-sm text-slate-500">No hay reactivos que coincidan con los filtros.</p>}
            {filtered.map((item) => (
              <article key={item.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{item.itemCode}</p>
                    <p className="mt-1 text-xs text-slate-500">{[item.category?.name, item.competency?.name, item.scale?.name, item.subscale?.name].filter(Boolean).join(' / ') || 'Sin clasificación'}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(item.versions || []).map((version) => (
                    <Link key={version.id} href={`/staff/admin/item-bank/items/${version.id}`} className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-indigo-400">
                      v{version.version} · {version.status}
                    </Link>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="mt-4 block">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} required={required} className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
    </label>
  );
}
