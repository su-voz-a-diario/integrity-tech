'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '../../../components/staff/AdminShell';
import { apiClient, ApiClientError } from '../../../services/api-client';
import type { EditorialAction, EditorialVersionModel } from '../../../generated/api/types';

type AssessmentVersion = {
  id: string;
  version: string;
  title?: string;
  status: string;
  publishedAt?: string | null;
  retiredAt?: string | null;
  createdAt?: string;
  _count?: { items?: number };
};

type Assessment = {
  id: string;
  code: string;
  name?: string;
  title: string;
  status: string;
  versions?: AssessmentVersion[];
};

type ItemVersion = {
  id: string;
  version: string;
  status: string;
  language?: string;
  hasScoringKey?: boolean;
  sensitiveFieldsRedacted?: boolean;
  publishedAt?: string | null;
  retiredAt?: string | null;
};

type Item = {
  id: string;
  code: string;
  itemCode?: string;
  status: string;
  category?: { name: string } | null;
  competency?: { name: string } | null;
  scale?: { name: string } | null;
  subscale?: { name: string } | null;
  versions?: ItemVersion[];
};

type Notice = { type: 'success' | 'error'; message: string } | null;

const actionLabels: Record<EditorialAction, string> = {
  request_internal_review: 'Enviar a revisión interna',
  request_psychologist_review: 'Enviar a revisión psicológica',
  approve: 'Aprobar',
  publish: 'Publicar',
  retire: 'Retirar',
  return_to_draft: 'Devolver a borrador',
};

const statusTone: Record<string, string> = {
  DRAFT: 'border-slate-700 bg-slate-900 text-slate-300',
  INTERNAL_REVIEW: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  PSYCHOLOGIST_REVIEW: 'border-violet-500/40 bg-violet-500/10 text-violet-200',
  APPROVED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  PUBLISHED: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  RETIRED: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  ACTIVE: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
};

function getApiErrorMessage(status: number) {
  const messages: Record<number, string> = {
    400: 'La solicitud no cumple las reglas editoriales.',
    401: 'Tu sesión expiró. Inicia sesión de nuevo.',
    403: 'No tienes permisos para acceder a la consola editorial.',
    404: 'El recurso psicométrico no está disponible.',
    409: 'La versión no permite esa acción en su estado actual.',
    429: 'Demasiadas solicitudes. Espera unos minutos e inténtalo nuevamente.',
  };
  return messages[status] || 'No se pudo completar la operación.';
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-md border px-2 py-1 text-[11px] font-bold ${statusTone[status] || statusTone.DRAFT}`}>
      {status}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function PsychometricsEditorialConsole() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const authToken = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('auth-token') || '';
  }, []);

  const selectedAssessment = assessments.find((assessment) => assessment.id === selectedAssessmentId) || assessments[0];
  const selectedItem = items.find((item) => item.id === selectedItemId) || items[0];

  const apiFetch = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      try {
        return await apiClient.raw(path, {
          ...options,
          token: authToken,
        }).then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.message || getApiErrorMessage(res.status));
          }
          return res.json();
        });
      } catch (error) {
        if (error instanceof ApiClientError) throw new Error(getApiErrorMessage(error.status));
        throw error;
      }
    },
    [authToken],
  );

  const loadData = useCallback(async () => {
    if (!authToken) {
      setNotice({ type: 'error', message: 'Sesión requerida. Inicia sesión como staff autorizado.' });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [assessmentData, itemData] = await Promise.all([
        apiFetch<Assessment[]>('/api/psychometric-governance/assessments'),
        apiFetch<Item[]>('/api/psychometric-governance/items'),
      ]);
      setAssessments(assessmentData);
      setItems(itemData);
      setSelectedAssessmentId((current) => current || assessmentData[0]?.id || null);
      setSelectedItemId((current) => current || itemData[0]?.id || null);
      setNotice(null);
    } catch (error: any) {
      setNotice({ type: 'error', message: error.message || 'No se pudo cargar la consola editorial.' });
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch, authToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runWorkflowAction = async (model: EditorialVersionModel, versionId: string, action: EditorialAction) => {
    let reason: string | undefined;

    if (action === 'publish') {
      const ok = window.confirm('Publicar hará inmutable esta versión. ¿Deseas continuar?');
      if (!ok) return;
    }

    if (action === 'retire') {
      reason = window.prompt('Indica la razón obligatoria para retirar esta versión:') || '';
      if (!reason.trim()) {
        setNotice({ type: 'error', message: 'La razón de retiro es obligatoria.' });
        return;
      }
    }

    if (action === 'return_to_draft') {
      reason = window.prompt('Comentario obligatorio para devolver a borrador:') || '';
      if (!reason.trim()) {
        setNotice({ type: 'error', message: 'El comentario es obligatorio para devolver a borrador.' });
        return;
      }
    }

    setIsBusy(true);
    try {
      await apiFetch('/api/psychometric-governance/workflow', {
        method: 'POST',
        body: JSON.stringify({ model, versionId, action, reason }),
      });
      setNotice({ type: 'success', message: `Acción completada: ${actionLabels[action]}.` });
      await loadData();
    } catch (error: any) {
      setNotice({ type: 'error', message: error.message || 'No se pudo ejecutar la acción editorial.' });
    } finally {
      setIsBusy(false);
    }
  };

  const createVersionFromPublished = async (model: EditorialVersionModel, sourceVersionId: string) => {
    const newVersion = window.prompt('Nueva etiqueta de versión, por ejemplo 1.1.0:') || '';
    if (!newVersion.trim()) {
      setNotice({ type: 'error', message: 'La nueva versión es obligatoria.' });
      return;
    }

    setIsBusy(true);
    try {
      await apiFetch('/api/psychometric-governance/versions/from-published', {
        method: 'POST',
        body: JSON.stringify({ model, sourceVersionId, newVersion }),
      });
      setNotice({ type: 'success', message: 'Nueva versión DRAFT creada desde la versión publicada.' });
      await loadData();
    } catch (error: any) {
      setNotice({ type: 'error', message: error.message || 'No se pudo crear la nueva versión.' });
    } finally {
      setIsBusy(false);
    }
  };

  const createAssessment = async () => {
    const name = window.prompt('Nombre de la nueva evaluación:') || '';
    if (!name.trim()) {
      setNotice({ type: 'error', message: 'El nombre de la evaluación es obligatorio.' });
      return;
    }

    const defaultCode = name
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase()
      .slice(0, 80);
    const code = window.prompt('Código único de la evaluación:', defaultCode) || '';
    if (!code.trim()) {
      setNotice({ type: 'error', message: 'El código de la evaluación es obligatorio.' });
      return;
    }

    const description = window.prompt('Descripción breve de la evaluación:') || '';

    setIsBusy(true);
    try {
      const created = await apiFetch<{ assessment: Assessment }>('/api/psychometric-governance/assessments', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), code: code.trim(), description: description.trim() || undefined }),
      });
      setNotice({ type: 'success', message: 'Evaluación creada con versión inicial DRAFT.' });
      await loadData();
      setSelectedAssessmentId(created.assessment.id);
    } catch (error: any) {
      setNotice({ type: 'error', message: error.message || 'No se pudo crear la evaluación.' });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <AdminShell active="Evaluaciones">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-slate-800 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-300">Gobierno psicométrico</p>
            <h1 className="mt-1 text-2xl font-extrabold text-white md:text-3xl">Consola editorial</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Administración mínima de pruebas, reactivos, versiones y publicación controlada.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={createAssessment}
              disabled={isLoading || isBusy}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Nueva evaluación
            </button>
            <button
              onClick={loadData}
              disabled={isLoading || isBusy}
              className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Actualizar
            </button>
          </div>
        </header>

        {notice && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              notice.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                : 'border-rose-500/40 bg-rose-500/10 text-rose-100'
            }`}
          >
            {notice.message}
          </div>
        )}

        {isLoading ? (
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-sm text-slate-300">
            Cargando gobierno psicométrico...
          </section>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">Pruebas</h2>
                  <p className="text-xs text-slate-400">Assessment list y versiones publicables.</p>
                </div>
                <span className="text-xs font-semibold text-slate-500">{assessments.length} registros</span>
              </div>

              <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                <div className="flex max-h-[560px] flex-col gap-2 overflow-auto pr-1">
                  {assessments.length === 0 && <p className="text-sm text-slate-400">No hay pruebas versionadas.</p>}
                  {assessments.map((assessment) => (
                    <button
                      key={assessment.id}
                      onClick={() => setSelectedAssessmentId(assessment.id)}
                      className={`rounded-lg border p-3 text-left transition ${
                        selectedAssessment?.id === assessment.id
                          ? 'border-indigo-400 bg-indigo-500/10'
                          : 'border-slate-800 bg-slate-950 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-white">{assessment.title || assessment.name}</span>
                        <StatusBadge status={assessment.status} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{assessment.code}</p>
                    </button>
                  ))}
                </div>

                <VersionPanel
                  title={selectedAssessment?.title || selectedAssessment?.name || 'Sin prueba seleccionada'}
                  subtitle={selectedAssessment?.code || ''}
                  model="assessmentVersion"
                  versions={selectedAssessment?.versions || []}
                  disabled={isBusy}
                  onAction={runWorkflowAction}
                  onCreateVersion={createVersionFromPublished}
                />
              </div>
            </section>

            <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">Banco de reactivos</h2>
                  <p className="text-xs text-slate-400">Item bank y versiones de reactivos.</p>
                </div>
                <span className="text-xs font-semibold text-slate-500">{items.length} registros</span>
              </div>

              <div className="grid gap-4">
                <div className="flex max-h-56 flex-col gap-2 overflow-auto pr-1">
                  {items.length === 0 && <p className="text-sm text-slate-400">No hay reactivos versionados.</p>}
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className={`rounded-lg border p-3 text-left transition ${
                        selectedItem?.id === item.id
                          ? 'border-indigo-400 bg-indigo-500/10'
                          : 'border-slate-800 bg-slate-950 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-white">{item.code || item.itemCode}</span>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {[item.category?.name, item.competency?.name, item.scale?.name].filter(Boolean).join(' / ') ||
                          'Sin clasificación'}
                      </p>
                    </button>
                  ))}
                </div>

                <VersionPanel
                  title={selectedItem?.code || selectedItem?.itemCode || 'Sin reactivo seleccionado'}
                  subtitle={
                    [selectedItem?.category?.name, selectedItem?.competency?.name, selectedItem?.scale?.name]
                      .filter(Boolean)
                      .join(' / ') || 'Item versions'
                  }
                  model="itemVersion"
                  versions={selectedItem?.versions || []}
                  disabled={isBusy}
                  onAction={runWorkflowAction}
                  onCreateVersion={createVersionFromPublished}
                />
              </div>
            </section>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function VersionPanel({
  title,
  subtitle,
  model,
  versions,
  disabled,
  onAction,
  onCreateVersion,
}: {
  title: string;
  subtitle: string;
  model: EditorialVersionModel;
  versions: Array<AssessmentVersion | ItemVersion>;
  disabled: boolean;
  onAction: (model: EditorialVersionModel, versionId: string, action: EditorialAction) => void;
  onCreateVersion: (model: EditorialVersionModel, sourceVersionId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
      <div className="mb-4">
        <h3 className="text-base font-bold text-white">{title}</h3>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>

      <div className="flex flex-col gap-3">
        {versions.length === 0 && <p className="text-sm text-slate-400">No hay versiones para este registro.</p>}
        {versions.map((version) => {
          const isPublished = version.status === 'PUBLISHED' || version.status === 'ACTIVE';
          return (
            <article key={version.id} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-white">v{version.version}</span>
                    <StatusBadge status={version.status} />
                    {'hasScoringKey' in version && version.hasScoringKey && (
                      <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-amber-200">
                        Clave protegida
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Publicación: {formatDate(version.publishedAt)} · Retiro: {formatDate(version.retiredAt)}
                  </p>
                  {'sensitiveFieldsRedacted' in version && version.sensitiveFieldsRedacted && (
                    <p className="mt-1 text-xs text-slate-500">Parámetros sensibles ocultos en consola.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Link
                    href={
                      model === 'assessmentVersion'
                        ? `/staff/admin/evaluations/versions/${version.id}`
                        : `/staff/admin/item-bank/items/${version.id}`
                    }
                    className="rounded-md border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-100 transition hover:border-indigo-300"
                  >
                    Abrir detalle
                  </Link>
                  {(
                    [
                      'request_internal_review',
                      'request_psychologist_review',
                      'approve',
                      'publish',
                      'retire',
                      'return_to_draft',
                    ] as const
                  ).map(
                    (action) => (
                      <button
                        key={action}
                        onClick={() => onAction(model, version.id, action)}
                        disabled={disabled}
                        className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionLabels[action]}
                      </button>
                    ),
                  )}
                  {isPublished && (
                    <button
                      onClick={() => onCreateVersion(model, version.id)}
                      disabled={disabled}
                      className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-100 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Nueva versión
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
