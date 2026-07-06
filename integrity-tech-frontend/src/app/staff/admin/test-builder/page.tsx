'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { AdminShell, StatusBadge } from '../../../../components/staff/AdminShell';
import { apiClient, ApiClientError } from '../../../../services/api-client';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type Notice = { type: 'success' | 'error'; message: string } | null;
type BuilderSection = 'dashboard' | 'general' | 'factors' | 'facets' | 'items' | 'responseTypes' | 'scoring' | 'interpretations' | 'versions' | 'publication' | 'audit';

type AssessmentVersion = { id: string; version: string; status: string; title?: string; publishedAt?: string | null; retiredAt?: string | null; updatedAt?: string };
type Assessment = { id: string; code: string; name: string; description?: string | null; status: string; updatedAt?: string; versions?: AssessmentVersion[] };
type BuilderNode = { id: string; code: string; name: string; description?: string; definition?: string; factorCode?: string; weight: number; order: number; active: boolean; version?: string };
type InterpretationRange = { id: string; facetCode: string; min: number; max: number; label: string; text: string; recommendation: string; interviewQuestion: string; active: boolean };
type ResponseTypeDefinition = { code: string; label: string; options: string[]; validation?: Record<string, unknown>; active: boolean };
type ScoringConfig = { facetScore: string; globalScore: string; randomizeItems: boolean; randomizeFacets: boolean; fixedOrder: boolean; weights: Record<string, number>; cutScores: Array<{ min: number; max: number; label: string }> };
type Blueprint = {
  source?: string;
  assessmentCode?: string;
  shortName?: string;
  scientificDescription?: string;
  constructObjective?: string;
  candidateInstructions?: string;
  estimatedTimeMinutes?: number;
  author?: string;
  language?: string;
  scientificReferences?: { references?: string[] };
  factors?: BuilderNode[];
  facets?: BuilderNode[];
  responseTypes?: ResponseTypeDefinition[];
  scoringConfig?: ScoringConfig;
  interpretations?: Record<string, InterpretationRange[]>;
  normingConfig?: Record<string, unknown>;
  reportConfig?: Record<string, unknown>;
};
type VersionDetail = AssessmentVersion & { description?: string | null; blueprintJson?: Blueprint; assessment?: { id: string; code: string; name: string; description?: string | null }; itemLinks?: Array<{ sortOrder: number; itemVersion: ItemVersion & { item: Item } }>; readiness?: { ready: boolean; blockingIssues: string[]; warnings: string[] } };
type ItemVersion = { id: string; version: string; status: string; language?: string; stemJson?: any; tags?: any; difficulty?: number | null; discrimination?: number | null; expectedTimeSeconds?: number | null; hasScoringKey?: boolean };
type Item = { id: string; itemCode: string; status: string; category?: { name: string } | null; competency?: { name: string } | null; scale?: { name: string } | null; subscale?: { name: string } | null; versions?: ItemVersion[] };
type AuditEvent = { id: string; action: string; actorType: string; createdAt: string; metadata?: any; actor?: { email?: string; name?: string } | null };

type AssessmentForm = { name: string; code: string; shortName: string; scientificDescription: string; constructObjective: string; candidateInstructions: string; estimatedTimeMinutes: string; author: string; language: string; references: string };
type ItemForm = { itemCode: string; text: string; description: string; help: string; observations: string; factorCode: string; facetCode: string; responseType: string; isReverseScored: boolean; active: boolean; expectedTimeSeconds: string; constructMeasured: string; observableBehavior: string; itemHypothesis: string; scientificSource: string; bibliographyReference: string; doi: string; author: string; tags: string };

const defaultResponseTypes: ResponseTypeDefinition[] = [
  { code: 'LIKERT_5_AGREEMENT', label: 'Likert 5 Acuerdo', options: ['Totalmente en desacuerdo', 'En desacuerdo', 'Neutral', 'De acuerdo', 'Totalmente de acuerdo'], active: true },
  { code: 'LIKERT_5_FREQUENCY', label: 'Likert 5 Frecuencia', options: ['Nunca', 'Rara vez', 'A veces', 'Frecuentemente', 'Siempre'], active: true },
  { code: 'LIKERT_7', label: 'Likert 7', options: ['1', '2', '3', '4', '5', '6', '7'], active: true },
  { code: 'SINGLE_CHOICE', label: 'Selección única', options: [], active: true },
  { code: 'MULTIPLE_CHOICE', label: 'Selección múltiple', options: [], active: true },
  { code: 'FORCED_CHOICE', label: 'Forced Choice', options: [], active: true },
  { code: 'SJT', label: 'SJT', options: [], active: true },
  { code: 'RANKING', label: 'Ranking', options: [], active: true },
  { code: 'VISUAL_SCALE', label: 'Escala Visual', options: [], active: true },
  { code: 'NUMERIC', label: 'Numérico', options: [], active: true },
  { code: 'FREE_TEXT', label: 'Texto libre', options: [], active: true },
];

const initialAssessmentForm: AssessmentForm = { name: '', code: '', shortName: '', scientificDescription: '', constructObjective: '', candidateInstructions: '', estimatedTimeMinutes: '20', author: '', language: 'es', references: '' };
const initialItemForm: ItemForm = { itemCode: '', text: '', description: '', help: '', observations: '', factorCode: '', facetCode: '', responseType: 'LIKERT_5_AGREEMENT', isReverseScored: false, active: true, expectedTimeSeconds: '45', constructMeasured: '', observableBehavior: '', itemHypothesis: '', scientificSource: '', bibliographyReference: '', doi: '', author: '', tags: '' };
const blankScoring: ScoringConfig = { facetScore: 'sum', globalScore: 'sum', randomizeItems: true, randomizeFacets: false, fixedOrder: false, weights: {}, cutScores: [{ min: 0, max: 69, label: 'Alto Riesgo' }, { min: 70, max: 84, label: 'Riesgo Moderado' }, { min: 85, max: 100, label: 'Bajo Riesgo' }] };
const sections: Array<{ id: BuilderSection; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'general', label: 'Información General' },
  { id: 'factors', label: 'Factores' },
  { id: 'facets', label: 'Facetas' },
  { id: 'items', label: 'Reactivos' },
  { id: 'responseTypes', label: 'Tipos de Respuesta' },
  { id: 'scoring', label: 'Motor de Corrección' },
  { id: 'interpretations', label: 'Interpretaciones' },
  { id: 'versions', label: 'Versiones' },
  { id: 'publication', label: 'Publicación' },
  { id: 'audit', label: 'Auditoría' },
];

function codeFrom(value: string) {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase().slice(0, 80);
}
function uniqueId(prefix: string) { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }
function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Sin fecha'; }
function normalizeBlueprint(input?: Blueprint): Blueprint {
  const source = input || {};
  return {
    ...source,
    source: source.source || 'test_builder',
    responseTypes: Array.isArray(source.responseTypes) && source.responseTypes.length ? source.responseTypes : defaultResponseTypes,
    scoringConfig: { ...blankScoring, ...(source.scoringConfig || {}) },
    interpretations: source.interpretations || {},
    factors: Array.isArray(source.factors)
      ? source.factors.map((factor, index) => ({ ...factor, active: factor.active ?? true, weight: factor.weight ?? 1, order: factor.order ?? index, id: factor.id || factor.code || uniqueId('factor') }))
      : [],
    facets: Array.isArray(source.facets)
      ? source.facets.map((facet, index) => ({ ...facet, active: facet.active ?? true, weight: facet.weight ?? 1, order: facet.order ?? index, id: facet.id || facet.code || uniqueId('facet') }))
      : [],
    normingConfig: source.normingConfig || { enabled: false, status: 'not_configured' },
    reportConfig: source.reportConfig || { sections: ['summary', 'factors', 'facets', 'interview_questions'] },
  };
}
function itemActive(item: Item, version?: ItemVersion) { return item.status !== 'INACTIVE' && item.status !== 'RETIRED' && version?.stemJson?.active !== false && version?.tags?.active !== false; }
function itemFacetCode(version?: ItemVersion) { return version?.stemJson?.facetCode || version?.tags?.facetCode || codeFrom(version?.stemJson?.facet || version?.tags?.facet || ''); }
function itemFactorCode(version?: ItemVersion) { return version?.stemJson?.factorCode || version?.tags?.factorCode || codeFrom(version?.stemJson?.factor || version?.tags?.factor || ''); }

export default function ProfessionalTestBuilderPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [detail, setDetail] = useState<VersionDetail | null>(null);
  const [history, setHistory] = useState<AuditEvent[]>([]);
  const [section, setSection] = useState<BuilderSection>('dashboard');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [selectedItemVersionIds, setSelectedItemVersionIds] = useState<string[]>([]);
  const [assessmentForm, setAssessmentForm] = useState<AssessmentForm>(initialAssessmentForm);
  const [itemForm, setItemForm] = useState<ItemForm>(initialItemForm);
  const [factorDraft, setFactorDraft] = useState<BuilderNode | null>(null);
  const [facetDraft, setFacetDraft] = useState<BuilderNode | null>(null);
  const [itemFilter, setItemFilter] = useState<StatusFilter>('ALL');
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const selectedAssessment = useMemo(() => assessments.find((assessment) => assessment.id === selectedAssessmentId) || assessments[0], [assessments, selectedAssessmentId]);
  const selectedVersion = useMemo(() => (selectedAssessment?.versions || []).find((version) => version.id === selectedVersionId) || selectedAssessment?.versions?.[0], [selectedAssessment, selectedVersionId]);
  const blueprint = useMemo(() => normalizeBlueprint(detail?.blueprintJson), [detail]);
  const editable = Boolean(detail && ['DRAFT', 'INTERNAL_REVIEW'].includes(detail.status));
  const allItemVersions = useMemo(() => items.flatMap((item) => (item.versions || []).map((version) => ({ item, version }))), [items]);
  const linkedIds = useMemo(() => new Set((detail?.itemLinks || []).map((link) => link.itemVersion.id)), [detail]);
  const filteredItemVersions = useMemo(() => allItemVersions.filter(({ item, version }) => itemFilter === 'ALL' || (itemFilter === 'ACTIVE' ? itemActive(item, version) : !itemActive(item, version))), [allItemVersions, itemFilter]);
  const metrics = useMemo(() => {
    const versions = assessments.flatMap((assessment) => assessment.versions || []);
    return {
      assessments: assessments.length,
      versions: versions.length,
      published: versions.filter((version) => version.status === 'PUBLISHED').length,
      drafts: versions.filter((version) => version.status === 'DRAFT').length,
      factors: blueprint.factors?.filter((factor) => factor.active !== false).length || 0,
      facets: blueprint.facets?.filter((facet) => facet.active !== false).length || 0,
      items: items.length,
      responseTypes: blueprint.responseTypes?.filter((type) => type.active !== false).length || 0,
    };
  }, [assessments, blueprint, items]);

  async function load() {
    setLoading(true);
    try {
      const [assessmentData, itemData] = await Promise.all([
        apiClient.get<Assessment[]>('/psychometric-governance/assessments'),
        apiClient.get<Item[]>('/psychometric-governance/items'),
      ]);
      setAssessments(Array.isArray(assessmentData) ? assessmentData : []);
      setItems(Array.isArray(itemData) ? itemData : []);
      setNotice(null);
    } catch (error: any) {
      setNotice({ type: 'error', message: error instanceof ApiClientError ? error.message : error.message || 'No se pudo cargar Test Builder.' });
    } finally {
      setLoading(false);
    }
  }
  async function loadDetail(versionId: string) {
    if (!versionId) return;
    try {
      const [versionDetail, versionHistory] = await Promise.all([
        apiClient.get<VersionDetail>(`/psychometric-governance/assessment-versions/${versionId}/detail`),
        apiClient.get<AuditEvent[]>(`/psychometric-governance/versions/assessmentVersion/${versionId}/history`),
      ]);
      setDetail(versionDetail);
      setHistory(versionHistory);
      setSelectedItemVersionIds((versionDetail.itemLinks || []).map((link) => link.itemVersion.id));
    } catch (error: any) {
      setDetail(null);
      setHistory([]);
      setNotice({ type: 'error', message: error.message || 'No se pudo cargar la versión científica.' });
    }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { if (!selectedAssessmentId && assessments[0]) setSelectedAssessmentId(assessments[0].id); }, [assessments, selectedAssessmentId]);
  useEffect(() => { if (selectedVersion?.id && selectedVersion.id !== selectedVersionId) setSelectedVersionId(selectedVersion.id); }, [selectedVersion?.id, selectedVersionId]);
  useEffect(() => { if (selectedVersionId) loadDetail(selectedVersionId); }, [selectedVersionId]);

  async function refreshAll(versionId = selectedVersionId) { await load(); if (versionId) await loadDetail(versionId); }
  async function updateBlueprint(nextBlueprint: Blueprint, message = 'Cambios guardados.') {
    if (!detail) return;
    if (!editable) { setNotice({ type: 'error', message: 'Solo puedes editar versiones DRAFT o INTERNAL_REVIEW.' }); return; }
    setBusy(true);
    try {
      const normalized = normalizeBlueprint(nextBlueprint);
      await apiClient.patch('/psychometric-governance/versions', { model: 'assessmentVersion', versionId: detail.id, data: { blueprintJson: normalized } });
      setNotice({ type: 'success', message });
      await loadDetail(detail.id);
    } catch (error: any) {
      setNotice({ type: 'error', message: error.message || 'No se pudo guardar la versión.' });
    } finally { setBusy(false); }
  }
  async function updateVersionData(data: Record<string, unknown>, message = 'Versión actualizada.') {
    if (!detail) return;
    if (!editable) { setNotice({ type: 'error', message: 'Solo puedes editar versiones DRAFT o INTERNAL_REVIEW.' }); return; }
    setBusy(true);
    try {
      await apiClient.patch('/psychometric-governance/versions', { model: 'assessmentVersion', versionId: detail.id, data });
      setNotice({ type: 'success', message });
      await loadDetail(detail.id);
    } catch (error: any) { setNotice({ type: 'error', message: error.message || 'No se pudo actualizar.' }); }
    finally { setBusy(false); }
  }

  async function createAssessment(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const created = await apiClient.post<{ assessment: Assessment; initialVersion: AssessmentVersion }>('/psychometric-governance/assessments', {
        name: assessmentForm.name.trim(),
        code: assessmentForm.code.trim() || codeFrom(assessmentForm.name),
        shortName: assessmentForm.shortName.trim() || undefined,
        description: assessmentForm.scientificDescription.trim() || undefined,
        scientificDescription: assessmentForm.scientificDescription.trim() || undefined,
        constructObjective: assessmentForm.constructObjective.trim() || undefined,
        candidateInstructions: assessmentForm.candidateInstructions.trim() || undefined,
        estimatedTimeMinutes: Number(assessmentForm.estimatedTimeMinutes) || undefined,
        author: assessmentForm.author.trim() || undefined,
        language: assessmentForm.language.trim() || 'es',
        scientificReferences: { references: assessmentForm.references.split('\n').map((line) => line.trim()).filter(Boolean) },
        factors: [],
        facets: [],
        responseTypes: defaultResponseTypes,
        scoringConfig: blankScoring,
        normingConfig: { enabled: false, status: 'not_configured' },
        reportConfig: { sections: ['summary', 'factors', 'facets', 'interview_questions'] },
      });
      setAssessmentForm(initialAssessmentForm);
      setSelectedAssessmentId(created.assessment.id);
      setSelectedVersionId(created.initialVersion.id);
      setSection('factors');
      setNotice({ type: 'success', message: 'Evaluación creada. Continúa con factores, facetas y reactivos.' });
      await refreshAll(created.initialVersion.id);
    } catch (error: any) { setNotice({ type: 'error', message: error.message || 'No se pudo crear la evaluación.' }); }
    finally { setBusy(false); }
  }

  function saveFactor(draft: BuilderNode) {
    const factors = [...(blueprint.factors || [])];
    const clean = { ...draft, code: draft.code || codeFrom(draft.name), id: draft.id || uniqueId('factor'), active: draft.active !== false, order: draft.order ?? factors.length, weight: Number(draft.weight) || 1, version: draft.version || '1.0.0' };
    const index = factors.findIndex((factor) => factor.id === clean.id);
    if (index >= 0) factors[index] = clean; else factors.push(clean);
    updateBlueprint({ ...blueprint, factors: factors.map((factor, order) => ({ ...factor, order })) }, 'Factor guardado.');
    setFactorDraft(null);
  }
  function saveFacet(draft: BuilderNode) {
    const facets = [...(blueprint.facets || [])];
    const clean = { ...draft, code: draft.code || codeFrom(draft.name), id: draft.id || uniqueId('facet'), active: draft.active !== false, order: draft.order ?? facets.length, weight: Number(draft.weight) || 1, version: draft.version || '1.0.0' };
    const index = facets.findIndex((facet) => facet.id === clean.id);
    if (index >= 0) facets[index] = clean; else facets.push(clean);
    updateBlueprint({ ...blueprint, facets: facets.map((facet, order) => ({ ...facet, order })) }, 'Faceta guardada.');
    setFacetDraft(null);
  }
  function duplicateNode(kind: 'factor' | 'facet', node: BuilderNode) {
    const copy = { ...node, id: uniqueId(kind), code: `${node.code}_COPY_${Date.now().toString().slice(-4)}`, name: `${node.name} copia`, active: true };
    if (kind === 'factor') updateBlueprint({ ...blueprint, factors: [...(blueprint.factors || []), { ...copy, order: blueprint.factors?.length || 0 }] }, 'Factor duplicado.');
    else updateBlueprint({ ...blueprint, facets: [...(blueprint.facets || []), { ...copy, order: blueprint.facets?.length || 0 }] }, 'Faceta duplicada.');
  }
  function toggleNode(kind: 'factor' | 'facet', node: BuilderNode) {
    const key = kind === 'factor' ? 'factors' : 'facets';
    const next = ((blueprint as any)[key] || []).map((item: BuilderNode) => item.id === node.id ? { ...item, active: item.active === false } : item);
    updateBlueprint({ ...blueprint, [key]: next }, node.active === false ? 'Registro activado.' : 'Registro desactivado.');
  }
  function reorderNodes(kind: 'factor' | 'facet', targetId: string) {
    if (!dragId || dragId === targetId) return;
    const key = kind === 'factor' ? 'factors' : 'facets';
    const list = [...(((blueprint as any)[key] || []) as BuilderNode[])];
    const from = list.findIndex((item) => item.id === dragId);
    const to = list.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    updateBlueprint({ ...blueprint, [key]: list.map((item, order) => ({ ...item, order })) }, 'Orden actualizado.');
    setDragId(null);
  }

  async function createItem(event: React.FormEvent) {
    event.preventDefault();
    const factor = blueprint.factors?.find((entry) => entry.code === itemForm.factorCode);
    const facet = blueprint.facets?.find((entry) => entry.code === itemForm.facetCode);
    const responseType = blueprint.responseTypes?.find((entry) => entry.code === itemForm.responseType) || defaultResponseTypes[0];
    setBusy(true);
    try {
      const created = await apiClient.post<{ itemVersion: ItemVersion }>('/psychometric-governance/items', {
        itemCode: itemForm.itemCode.trim() || codeFrom(itemForm.text).slice(0, 60),
        text: itemForm.text.trim(),
        category: itemForm.constructMeasured.trim() || factor?.name || undefined,
        competency: itemForm.constructMeasured.trim() || undefined,
        scale: factor?.name,
        subscale: facet?.name,
        responseType: itemForm.responseType,
        isReverseScored: itemForm.isReverseScored,
        expectedTimeSeconds: Number(itemForm.expectedTimeSeconds) || undefined,
        constructMeasured: itemForm.constructMeasured.trim() || undefined,
        observableBehavior: itemForm.observableBehavior.trim() || undefined,
        itemHypothesis: itemForm.itemHypothesis.trim() || undefined,
        scientificSource: itemForm.scientificSource.trim() || undefined,
        bibliographyReference: itemForm.bibliographyReference.trim() || undefined,
        doi: itemForm.doi.trim() || undefined,
        authorNotes: itemForm.observations.trim() || undefined,
        stemJson: {
          type: itemForm.responseType,
          responseType: itemForm.responseType,
          prompt: itemForm.text.trim(),
          text: itemForm.text.trim(),
          description: itemForm.description.trim() || undefined,
          help: itemForm.help.trim() || undefined,
          observations: itemForm.observations.trim() || undefined,
          factor: factor?.name,
          factorCode: factor?.code,
          facet: facet?.name,
          facetCode: facet?.code,
          options: responseType.options,
          isReverseScored: itemForm.isReverseScored,
          active: itemForm.active,
          author: itemForm.author.trim() || undefined,
          authoredAt: new Date().toISOString(),
        },
        tags: { raw: itemForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean), factorCode: factor?.code, facetCode: facet?.code, active: itemForm.active },
      });
      setSelectedItemVersionIds((current) => Array.from(new Set([...current, created.itemVersion.id])));
      setItemForm(initialItemForm);
      setNotice({ type: 'success', message: 'Reactivo creado en banco general.' });
      await refreshAll();
    } catch (error: any) { setNotice({ type: 'error', message: error.message || 'No se pudo crear el reactivo.' }); }
    finally { setBusy(false); }
  }
  async function duplicateItem(item: Item, version: ItemVersion) {
    setBusy(true);
    try {
      const detail = await apiClient.get<ItemVersion & { item: Item }>(`/psychometric-governance/item-versions/${version.id}/detail`);
      const baseCode = `${item.itemCode}_COPY_${Date.now().toString().slice(-4)}`;
      await apiClient.post('/psychometric-governance/items', {
        itemCode: baseCode,
        category: item.category?.name || undefined,
        competency: item.competency?.name || undefined,
        scale: item.scale?.name || undefined,
        subscale: item.subscale?.name || undefined,
        stemJson: { ...(detail.stemJson || {}), duplicatedFromItemVersionId: version.id, active: true },
        tags: { ...(detail.tags || {}), duplicatedFromItemVersionId: version.id, active: true },
        responseType: detail.stemJson?.responseType || detail.stemJson?.type,
        isReverseScored: Boolean(detail.stemJson?.isReverseScored),
        expectedTimeSeconds: detail.expectedTimeSeconds || undefined,
        difficulty: detail.difficulty || undefined,
        discrimination: detail.discrimination || undefined,
      });
      setNotice({ type: 'success', message: 'Reactivo duplicado como nueva ItemVersion DRAFT.' });
      await refreshAll();
    } catch (error: any) { setNotice({ type: 'error', message: error.message || 'No se pudo duplicar el reactivo.' }); }
    finally { setBusy(false); }
  }
  async function toggleItem(item: Item, version: ItemVersion) {
    setBusy(true);
    try {
      const nextActive = !itemActive(item, version);
      await apiClient.patch('/psychometric-governance/versions', {
        model: 'itemVersion',
        versionId: version.id,
        data: {
          stemJson: { ...(version.stemJson || {}), active: nextActive },
          tags: { ...(version.tags || {}), active: nextActive },
        },
      });
      setNotice({ type: 'success', message: nextActive ? 'Reactivo activado.' : 'Reactivo desactivado.' });
      await refreshAll();
    } catch (error: any) { setNotice({ type: 'error', message: error.message || 'No se pudo actualizar el reactivo.' }); }
    finally { setBusy(false); }
  }
  async function persistItemOrder(targetId?: string) {
    if (!detail) return;
    let ids = [...selectedItemVersionIds];
    if (dragId && targetId && dragId !== targetId) {
      const from = ids.indexOf(dragId);
      const to = ids.indexOf(targetId);
      if (from >= 0 && to >= 0) {
        const [moved] = ids.splice(from, 1);
        ids.splice(to, 0, moved);
        setSelectedItemVersionIds(ids);
      }
    }
    setBusy(true);
    try {
      const response = await apiClient.raw(`/api/psychometric-governance/assessment-versions/${detail.id}/items`, {
        method: 'PUT',
        body: JSON.stringify({ items: ids.map((itemVersionId, index) => ({ itemVersionId, sortOrder: index, weight: 1, role: 'SCORED' })) }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'No se pudo guardar el orden.');
      setNotice({ type: 'success', message: 'Reactivos y orden persistidos.' });
      setDragId(null);
      await loadDetail(detail.id);
    } catch (error: any) { setNotice({ type: 'error', message: error.message || 'No se pudo guardar el orden.' }); }
    finally { setBusy(false); }
  }

  async function saveScoring(scoringConfig: ScoringConfig) { await updateBlueprint({ ...blueprint, scoringConfig }, 'Motor de corrección actualizado.'); }
  async function saveResponseTypes(responseTypes: ResponseTypeDefinition[]) { await updateBlueprint({ ...blueprint, responseTypes }, 'Tipos de respuesta actualizados.'); }
  async function saveInterpretation(facetCode: string, range: InterpretationRange) {
    const interpretations = { ...(blueprint.interpretations || {}) };
    const ranges = [...(interpretations[facetCode] || [])];
    const clean = { ...range, id: range.id || uniqueId('range'), facetCode, active: range.active !== false };
    const index = ranges.findIndex((item) => item.id === clean.id);
    if (index >= 0) ranges[index] = clean; else ranges.push(clean);
    interpretations[facetCode] = ranges.sort((a, b) => a.min - b.min);
    await updateBlueprint({ ...blueprint, interpretations }, 'Interpretación guardada.');
  }
  async function workflow(action: string) {
    if (!detail) return;
    const reason = action === 'retire' || action === 'return_to_draft' ? window.prompt(action === 'retire' ? 'Razón obligatoria para retirar:' : 'Comentario obligatorio:') || '' : undefined;
    if ((action === 'retire' || action === 'return_to_draft') && !reason?.trim()) { setNotice({ type: 'error', message: 'El comentario es obligatorio.' }); return; }
    if (action === 'publish' && !window.confirm('Publicar hará inmutable esta versión y la habilitará para reclutamiento. ¿Continuar?')) return;
    setBusy(true);
    try {
      await apiClient.post('/psychometric-governance/workflow', { model: 'assessmentVersion', versionId: detail.id, action, reason });
      setNotice({ type: 'success', message: 'Workflow actualizado.' });
      await refreshAll(detail.id);
    } catch (error: any) { setNotice({ type: 'error', message: error.message || 'No se pudo ejecutar la acción.' }); }
    finally { setBusy(false); }
  }
  async function cloneVersion() {
    if (!detail) return;
    const newVersion = window.prompt('Nueva versión, por ejemplo 1.1.0:') || '';
    if (!newVersion.trim()) return;
    setBusy(true);
    try {
      const created = await apiClient.post<AssessmentVersion>('/psychometric-governance/versions/from-published', { model: 'assessmentVersion', sourceVersionId: detail.id, newVersion: newVersion.trim() });
      setSelectedVersionId(created.id);
      setNotice({ type: 'success', message: 'Nueva versión editable creada.' });
      await refreshAll(created.id);
    } catch (error: any) { setNotice({ type: 'error', message: error.message || 'No se pudo crear la versión.' }); }
    finally { setBusy(false); }
  }

  return (
    <AdminShell active="Test Builder" title="Test Builder" subtitle="Workspace profesional para diseñar, versionar y publicar evaluaciones psicométricas modernas.">
      {notice && <div className={`rounded-lg border px-4 py-3 text-sm ${notice.type === 'success' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' : 'border-rose-500/40 bg-rose-500/10 text-rose-100'}`}>{notice.message}</div>}
      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <aside className="rounded-lg border border-slate-800 bg-slate-900 p-4 xl:sticky xl:top-6 xl:self-start">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Workspace</div>
          <select value={selectedAssessment?.id || ''} onChange={(event) => { setSelectedAssessmentId(event.target.value); setSelectedVersionId(''); }} className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400">
            {assessments.length === 0 && <option value="">Sin evaluaciones</option>}
            {assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.name}</option>)}
          </select>
          <select value={selectedVersion?.id || ''} onChange={(event) => setSelectedVersionId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400">
            {(selectedAssessment?.versions || []).map((version) => <option key={version.id} value={version.id}>v{version.version} · {version.status}</option>)}
          </select>
          {detail && <div className="mt-3 flex items-center gap-2"><StatusBadge status={detail.status} /><span className="text-xs text-slate-500">{editable ? 'Editable' : 'Inmutable'}</span></div>}
          <nav className="mt-5 grid gap-2">
            {sections.map((entry) => <button key={entry.id} onClick={() => setSection(entry.id)} className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition ${section === entry.id ? 'border-indigo-400 bg-indigo-500/10 text-indigo-100' : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'}`}>{entry.label}</button>)}
          </nav>
        </aside>

        <main className="min-w-0">
          {loading ? <Skeleton /> : (
            <div className="flex flex-col gap-6">
              {section === 'dashboard' && <Dashboard metrics={metrics} assessments={assessments} history={history} />}
              {section === 'general' && <GeneralSection form={assessmentForm} setForm={setAssessmentForm} onCreate={createAssessment} detail={detail} blueprint={blueprint} editable={editable} busy={busy} onSave={(next) => updateVersionData({ title: next.title, description: next.description, blueprintJson: next.blueprint }, 'Información general actualizada.')} />}
              {section === 'factors' && <NodeSection title="Factores" type="factor" nodes={blueprint.factors || []} related={blueprint.facets || []} items={allItemVersions} draft={factorDraft} setDraft={setFactorDraft} onSave={saveFactor} onDuplicate={(node) => duplicateNode('factor', node)} onToggle={(node) => toggleNode('factor', node)} onDrop={(id) => reorderNodes('factor', id)} setDragId={setDragId} editable={editable} />}
              {section === 'facets' && <NodeSection title="Facetas" type="facet" nodes={blueprint.facets || []} related={[]} factors={blueprint.factors || []} items={allItemVersions} draft={facetDraft} setDraft={setFacetDraft} onSave={saveFacet} onDuplicate={(node) => duplicateNode('facet', node)} onToggle={(node) => toggleNode('facet', node)} onDrop={(id) => reorderNodes('facet', id)} setDragId={setDragId} editable={editable} />}
              {section === 'items' && <ItemsSection form={itemForm} setForm={setItemForm} factors={blueprint.factors || []} facets={blueprint.facets || []} responseTypes={blueprint.responseTypes || defaultResponseTypes} items={filteredItemVersions} selectedIds={selectedItemVersionIds} linkedIds={linkedIds} filter={itemFilter} setFilter={setItemFilter} setSelectedIds={setSelectedItemVersionIds} onCreate={createItem} onDuplicate={duplicateItem} onToggle={toggleItem} onPersistOrder={persistItemOrder} setDragId={setDragId} editable={editable} busy={busy} />}
              {section === 'responseTypes' && <ResponseTypesSection responseTypes={blueprint.responseTypes || defaultResponseTypes} onSave={saveResponseTypes} editable={editable} />}
              {section === 'scoring' && <ScoringSection scoring={blueprint.scoringConfig || blankScoring} factors={blueprint.factors || []} facets={blueprint.facets || []} onSave={saveScoring} editable={editable} />}
              {section === 'interpretations' && <InterpretationsSection facets={blueprint.facets || []} interpretations={blueprint.interpretations || {}} onSave={saveInterpretation} editable={editable} />}
              {section === 'versions' && <VersionsSection assessment={selectedAssessment} detail={detail} onClone={cloneVersion} busy={busy} />}
              {section === 'publication' && <PublicationSection detail={detail} onWorkflow={workflow} busy={busy} />}
              {section === 'audit' && <AuditSection history={history} />}
            </div>
          )}
        </main>
      </div>
    </AdminShell>
  );
}

function Dashboard({ metrics, assessments, history }: { metrics: any; assessments: Assessment[]; history: AuditEvent[] }) {
  const cards = [
    ['Evaluaciones', metrics.assessments], ['Versiones', metrics.versions], ['Publicadas', metrics.published], ['Borradores', metrics.drafts], ['Factores', metrics.factors], ['Facetas', metrics.facets], ['Reactivos', metrics.items], ['Tipos de respuesta', metrics.responseTypes],
  ];
  return <section className="grid gap-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <article key={label} className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-3xl font-extrabold text-white">{value}</p></article>)}</div><div className="grid gap-5 xl:grid-cols-2"><Panel title="Últimas publicaciones"><ListEmpty empty={assessments.length === 0}>{assessments.flatMap((a) => (a.versions || []).filter((v) => v.status === 'PUBLISHED').map((v) => <Row key={v.id} title={a.name} meta={`v${v.version} · ${formatDate(v.publishedAt)}`} />)).slice(0, 6)}</ListEmpty></Panel><Panel title="Últimas modificaciones"><ListEmpty empty={history.length === 0}>{history.slice(0, 6).map((event) => <Row key={event.id} title={event.actor?.name || event.actor?.email || event.actorType} meta={`${event.action} · ${formatDate(event.createdAt)}`} />)}</ListEmpty></Panel></div></section>;
}

function GeneralSection({ form, setForm, onCreate, detail, blueprint, editable, busy, onSave }: { form: AssessmentForm; setForm: (form: AssessmentForm) => void; onCreate: (event: React.FormEvent) => void; detail: VersionDetail | null; blueprint: Blueprint; editable: boolean; busy: boolean; onSave: (next: { title: string; description: string; blueprint: Blueprint }) => void }) {
  const [draft, setDraft] = useState({ title: detail?.title || '', description: detail?.description || '', shortName: blueprint.shortName || '', scientificDescription: blueprint.scientificDescription || '', constructObjective: blueprint.constructObjective || '', candidateInstructions: blueprint.candidateInstructions || '', estimatedTimeMinutes: String(blueprint.estimatedTimeMinutes || 20), author: blueprint.author || '', language: blueprint.language || 'es', references: (blueprint.scientificReferences?.references || []).join('\n') });
  useEffect(() => { setDraft({ title: detail?.title || '', description: detail?.description || '', shortName: blueprint.shortName || '', scientificDescription: blueprint.scientificDescription || '', constructObjective: blueprint.constructObjective || '', candidateInstructions: blueprint.candidateInstructions || '', estimatedTimeMinutes: String(blueprint.estimatedTimeMinutes || 20), author: blueprint.author || '', language: blueprint.language || 'es', references: (blueprint.scientificReferences?.references || []).join('\n') }); }, [detail?.id]);
  return <div className="grid gap-6 xl:grid-cols-[1fr_420px]"><Panel title="Crear nueva evaluación"><form onSubmit={onCreate} className="grid gap-3"><Field label="Nombre" value={form.name} onChange={(value) => setForm({ ...form, name: value, code: form.code || codeFrom(value) })} required /><Field label="Código único" value={form.code} onChange={(value) => setForm({ ...form, code: value })} required /><Field label="Nombre corto" value={form.shortName} onChange={(value) => setForm({ ...form, shortName: value })} /><TextArea label="Descripción científica" value={form.scientificDescription} onChange={(value) => setForm({ ...form, scientificDescription: value })} /><TextArea label="Objetivo del constructo" value={form.constructObjective} onChange={(value) => setForm({ ...form, constructObjective: value })} /><TextArea label="Instrucciones para candidato" value={form.candidateInstructions} onChange={(value) => setForm({ ...form, candidateInstructions: value })} /><div className="grid gap-3 md:grid-cols-3"><Field label="Tiempo min." value={form.estimatedTimeMinutes} onChange={(value) => setForm({ ...form, estimatedTimeMinutes: value })} /><Field label="Autor" value={form.author} onChange={(value) => setForm({ ...form, author: value })} /><Field label="Idioma" value={form.language} onChange={(value) => setForm({ ...form, language: value })} /></div><TextArea label="Referencias, una por línea" value={form.references} onChange={(value) => setForm({ ...form, references: value })} /><Primary disabled={busy || !form.name.trim() || !form.code.trim()}>Crear evaluación</Primary></form></Panel><Panel title="Editar versión actual"><div className="grid gap-3"><Field label="Título" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} /><Field label="Nombre corto" value={draft.shortName} onChange={(value) => setDraft({ ...draft, shortName: value })} /><TextArea label="Descripción científica" value={draft.scientificDescription} onChange={(value) => setDraft({ ...draft, scientificDescription: value })} /><TextArea label="Instrucciones" value={draft.candidateInstructions} onChange={(value) => setDraft({ ...draft, candidateInstructions: value })} /><Primary disabled={!editable || busy} onClick={() => onSave({ title: draft.title, description: draft.scientificDescription, blueprint: { ...blueprint, shortName: draft.shortName, scientificDescription: draft.scientificDescription, constructObjective: draft.constructObjective, candidateInstructions: draft.candidateInstructions, estimatedTimeMinutes: Number(draft.estimatedTimeMinutes) || undefined, author: draft.author, language: draft.language, scientificReferences: { references: draft.references.split('\n').map((line) => line.trim()).filter(Boolean) } } })}>Guardar versión</Primary></div></Panel></div>;
}

function NodeSection({ title, type, nodes, related, factors = [], items, draft, setDraft, onSave, onDuplicate, onToggle, onDrop, setDragId, editable }: { title: string; type: 'factor' | 'facet'; nodes: BuilderNode[]; related: BuilderNode[]; factors?: BuilderNode[]; items: Array<{ item: Item; version: ItemVersion }>; draft: BuilderNode | null; setDraft: (node: BuilderNode | null) => void; onSave: (node: BuilderNode) => void; onDuplicate: (node: BuilderNode) => void; onToggle: (node: BuilderNode) => void; onDrop: (id: string) => void; setDragId: (id: string | null) => void; editable: boolean }) {
  const sorted = [...nodes].sort((a, b) => a.order - b.order);
  return <div className="grid gap-5 xl:grid-cols-[1fr_360px]"><Panel title={title}><div className="grid gap-3">{sorted.length === 0 && <Empty text={`No hay ${title.toLowerCase()} configurados.`} />}{sorted.map((node) => { const facetCount = related.filter((entry) => entry.factorCode === node.code && entry.active !== false).length; const itemCount = items.filter(({ version }) => type === 'factor' ? itemFactorCode(version) === node.code : itemFacetCode(version) === node.code).length; return <article key={node.id} draggable={editable} onDragStart={() => setDragId(node.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => onDrop(node.id)} className="rounded-lg border border-slate-800 bg-slate-950 p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-white">{node.name}</p><Badge tone={node.active === false ? 'rose' : 'emerald'}>{node.active === false ? 'Inactivo' : 'Activo'}</Badge><Badge>v{node.version || '1.0.0'}</Badge></div><p className="mt-1 text-xs text-slate-500">{node.code} · peso {node.weight}</p><p className="mt-2 text-sm text-slate-300">{node.description || node.definition || 'Sin descripción'}</p></div><div className="flex flex-wrap gap-2"><SmallButton disabled={!editable} onClick={() => setDraft(node)}>Editar</SmallButton><SmallButton disabled={!editable} onClick={() => onDuplicate(node)}>Duplicar</SmallButton><SmallButton disabled={!editable} onClick={() => onToggle(node)}>{node.active === false ? 'Activar' : 'Desactivar'}</SmallButton></div></div><div className="mt-3 flex gap-2 text-xs text-slate-400"><span>{facetCount} facetas</span><span>{itemCount} reactivos</span><span>Arrastra para reordenar</span></div></article>; })}</div></Panel><Panel title={draft?.id ? 'Editar' : 'Crear'}><NodeEditor type={type} draft={draft} factors={factors} onChange={setDraft} onSave={onSave} editable={editable} /></Panel></div>;
}

function NodeEditor({ type, draft, factors, onChange, onSave, editable }: { type: 'factor' | 'facet'; draft: BuilderNode | null; factors: BuilderNode[]; onChange: (node: BuilderNode | null) => void; onSave: (node: BuilderNode) => void; editable: boolean }) {
  const node = draft || { id: '', code: '', name: '', description: '', definition: '', factorCode: factors[0]?.code || '', weight: 1, order: 0, active: true, version: '1.0.0' };
  return <div className="grid gap-3"><Field label="Nombre" value={node.name} onChange={(value) => onChange({ ...node, name: value, code: node.code || codeFrom(value) })} /><Field label="Código" value={node.code} onChange={(value) => onChange({ ...node, code: value })} />{type === 'facet' && <Select label="Factor" value={node.factorCode || ''} onChange={(value) => onChange({ ...node, factorCode: value })} options={factors.map((factor) => ({ value: factor.code, label: factor.name }))} />}<TextArea label={type === 'factor' ? 'Descripción científica' : 'Definición'} value={node.description || node.definition || ''} onChange={(value) => onChange({ ...node, description: value, definition: value })} /><Field label="Peso" value={String(node.weight)} onChange={(value) => onChange({ ...node, weight: Number(value) || 1 })} /><label className="flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={node.active !== false} onChange={(event) => onChange({ ...node, active: event.target.checked })} /> Activo</label><Primary disabled={!editable || !node.name.trim()} onClick={() => onSave(node)}>Guardar</Primary></div>;
}

function ItemsSection({ form, setForm, factors, facets, responseTypes, items, selectedIds, linkedIds, filter, setFilter, setSelectedIds, onCreate, onDuplicate, onToggle, onPersistOrder, setDragId, editable, busy }: { form: ItemForm; setForm: (form: ItemForm) => void; factors: BuilderNode[]; facets: BuilderNode[]; responseTypes: ResponseTypeDefinition[]; items: Array<{ item: Item; version: ItemVersion }>; selectedIds: string[]; linkedIds: Set<string>; filter: StatusFilter; setFilter: (filter: StatusFilter) => void; setSelectedIds: (ids: string[]) => void; onCreate: (event: React.FormEvent) => void; onDuplicate: (item: Item, version: ItemVersion) => void; onToggle: (item: Item, version: ItemVersion) => void; onPersistOrder: (targetId?: string) => void; setDragId: (id: string | null) => void; editable: boolean; busy: boolean }) {
  const availableFacets = facets.filter((facet) => !form.factorCode || facet.factorCode === form.factorCode);
  return <div className="grid gap-5 xl:grid-cols-[420px_1fr]"><Panel title="Editor profesional de reactivo"><form onSubmit={onCreate} className="grid gap-3"><TextArea label="Texto" value={form.text} onChange={(value) => setForm({ ...form, text: value, itemCode: form.itemCode || codeFrom(value).slice(0, 60) })} /><Field label="Código" value={form.itemCode} onChange={(value) => setForm({ ...form, itemCode: value })} /><Select label="Factor" value={form.factorCode} onChange={(value) => setForm({ ...form, factorCode: value, facetCode: '' })} options={factors.map((factor) => ({ value: factor.code, label: factor.name }))} /><Select label="Faceta" value={form.facetCode} onChange={(value) => setForm({ ...form, facetCode: value })} options={availableFacets.map((facet) => ({ value: facet.code, label: facet.name }))} /><Select label="Tipo de respuesta" value={form.responseType} onChange={(value) => setForm({ ...form, responseType: value })} options={responseTypes.map((type) => ({ value: type.code, label: type.label }))} /><div className="grid gap-2 md:grid-cols-2"><label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200"><input type="checkbox" checked={form.isReverseScored} onChange={(event) => setForm({ ...form, isReverseScored: event.target.checked })} /> Reactivo invertido</label><label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Activo</label></div><Field label="Constructo" value={form.constructMeasured} onChange={(value) => setForm({ ...form, constructMeasured: value })} /><Field label="DOI" value={form.doi} onChange={(value) => setForm({ ...form, doi: value })} /><TextArea label="Conducta observable" value={form.observableBehavior} onChange={(value) => setForm({ ...form, observableBehavior: value })} /><TextArea label="Referencia científica" value={form.scientificSource} onChange={(value) => setForm({ ...form, scientificSource: value })} /><Field label="Tags separados por coma" value={form.tags} onChange={(value) => setForm({ ...form, tags: value })} /><Primary disabled={busy || !editable || !form.text.trim()}>Crear reactivo</Primary></form></Panel><Panel title="Reactivos del banco"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex gap-2">{(['ALL', 'ACTIVE', 'INACTIVE'] as StatusFilter[]).map((value) => <SmallButton key={value} onClick={() => setFilter(value)}>{value}</SmallButton>)}</div><Primary disabled={!editable || busy} onClick={() => onPersistOrder()}>Persistir orden</Primary></div><div className="grid gap-3">{items.length === 0 && <Empty text="No hay reactivos para el filtro seleccionado." />}{items.map(({ item, version }) => { const active = itemActive(item, version); const checked = selectedIds.includes(version.id); return <article key={version.id} draggable={checked && editable} onDragStart={() => setDragId(version.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => onPersistOrder(version.id)} className={`rounded-lg border p-4 ${checked ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-800 bg-slate-950'}`}><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><label className="flex gap-3"><input type="checkbox" checked={checked} onChange={(event) => setSelectedIds(event.target.checked ? [...selectedIds, version.id] : selectedIds.filter((id) => id !== version.id))} /><span><span className="font-bold text-white">{item.itemCode}</span><span className="ml-2 text-xs text-slate-500">v{version.version}</span><p className="mt-1 text-sm text-slate-300">{version.stemJson?.text || version.stemJson?.prompt || 'Sin texto visible'}</p><p className="mt-1 text-xs text-slate-500">{version.stemJson?.factor || item.scale?.name || 'Sin factor'} / {version.stemJson?.facet || item.subscale?.name || 'Sin faceta'}</p></span></label><div className="flex flex-wrap gap-2"><Badge tone={active ? 'emerald' : 'rose'}>{active ? 'Activo' : 'Inactivo'}</Badge>{version.stemJson?.isReverseScored && <Badge tone="amber">Reactivo invertido</Badge>}{linkedIds.has(version.id) && <Badge tone="indigo">Vinculado</Badge>}<SmallButton disabled={!editable} onClick={() => onDuplicate(item, version)}>Duplicar</SmallButton><SmallButton disabled={!editable} onClick={() => onToggle(item, version)}>{active ? 'Desactivar' : 'Activar'}</SmallButton></div></div></article>; })}</div></Panel></div>;
}

function ResponseTypesSection({ responseTypes, onSave, editable }: { responseTypes: ResponseTypeDefinition[]; onSave: (types: ResponseTypeDefinition[]) => void; editable: boolean }) {
  const [types, setTypes] = useState(responseTypes);
  useEffect(() => setTypes(responseTypes), [responseTypes]);
  return <Panel title="Tipos de Respuesta"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{types.map((type, index) => <article key={type.code} className="rounded-lg border border-slate-800 bg-slate-950 p-4"><Field label="Etiqueta" value={type.label} onChange={(value) => setTypes(types.map((entry, i) => i === index ? { ...entry, label: value } : entry))} /><p className="mt-2 text-xs text-slate-500">{type.code}</p><TextArea label="Opciones, una por línea" value={type.options.join('\n')} onChange={(value) => setTypes(types.map((entry, i) => i === index ? { ...entry, options: value.split('\n').map((line) => line.trim()).filter(Boolean) } : entry))} /><label className="mt-2 flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={type.active !== false} onChange={(event) => setTypes(types.map((entry, i) => i === index ? { ...entry, active: event.target.checked } : entry))} /> Activo</label></article>)}</div><div className="mt-4"><Primary disabled={!editable} onClick={() => onSave(types)}>Guardar catálogo</Primary></div></Panel>;
}

function ScoringSection({ scoring, factors, facets, onSave, editable }: { scoring: ScoringConfig; factors: BuilderNode[]; facets: BuilderNode[]; onSave: (scoring: ScoringConfig) => void; editable: boolean }) {
  const [draft, setDraft] = useState(scoring);
  useEffect(() => setDraft(scoring), [scoring]);
  const weightedTargets = [...factors, ...facets];
  return <Panel title="Motor configurable"><div className="grid gap-4 md:grid-cols-2"><Select label="Puntuación por faceta" value={draft.facetScore} onChange={(value) => setDraft({ ...draft, facetScore: value })} options={[{ value: 'sum', label: 'Suma' }, { value: 'average', label: 'Promedio' }, { value: 'weighted', label: 'Ponderación' }]} /><Select label="Puntuación global" value={draft.globalScore} onChange={(value) => setDraft({ ...draft, globalScore: value })} options={[{ value: 'sum', label: 'Suma' }, { value: 'average', label: 'Promedio' }, { value: 'weighted', label: 'Ponderada' }]} /></div><div className="mt-4 grid gap-2 md:grid-cols-3"><Check label="Aleatorizar reactivos" checked={draft.randomizeItems} onChange={(value) => setDraft({ ...draft, randomizeItems: value })} /><Check label="Aleatorizar facetas" checked={draft.randomizeFacets} onChange={(value) => setDraft({ ...draft, randomizeFacets: value })} /><Check label="Orden fijo" checked={draft.fixedOrder} onChange={(value) => setDraft({ ...draft, fixedOrder: value })} /></div><div className="mt-5 grid gap-3 md:grid-cols-2">{weightedTargets.map((target) => <Field key={target.code} label={`Peso ${target.name}`} value={String(draft.weights?.[target.code] ?? target.weight ?? 1)} onChange={(value) => setDraft({ ...draft, weights: { ...(draft.weights || {}), [target.code]: Number(value) || 1 } })} />)}</div><div className="mt-4"><Primary disabled={!editable} onClick={() => onSave(draft)}>Guardar motor</Primary></div></Panel>;
}

function InterpretationsSection({ facets, interpretations, onSave, editable }: { facets: BuilderNode[]; interpretations: Record<string, InterpretationRange[]>; onSave: (facetCode: string, range: InterpretationRange) => void; editable: boolean }) {
  const [facetCode, setFacetCode] = useState(facets[0]?.code || '');
  const [draft, setDraft] = useState<InterpretationRange>({ id: '', facetCode: '', min: 0, max: 20, label: 'Riesgo Alto', text: '', recommendation: '', interviewQuestion: '', active: true });
  useEffect(() => {
    if (!facetCode && facets[0]) setFacetCode(facets[0].code);
  }, [facets, facetCode]);
  const ranges = interpretations[facetCode] || [];

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <Panel title="Interpretaciones por faceta">
        <Select
          label="Faceta"
          value={facetCode}
          onChange={setFacetCode}
          options={facets.map((facet) => ({ value: facet.code, label: facet.name }))}
        />
        <div className="mt-4 grid gap-3">
          {ranges.length === 0 && <Empty text="Esta faceta todavía no tiene interpretaciones." />}
          {ranges.map((range) => (
            <article key={range.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-white">{range.min}-{range.max} · {range.label}</p>
                  <p className="mt-2 text-sm text-slate-300">{range.text}</p>
                  <p className="mt-2 text-xs text-slate-500">{range.recommendation}</p>
                </div>
                <SmallButton disabled={!editable} onClick={() => setDraft(range)}>Editar</SmallButton>
              </div>
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="Constructor de interpretación">
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mín" value={String(draft.min)} onChange={(value) => setDraft({ ...draft, min: Number(value) || 0 })} />
            <Field label="Máx" value={String(draft.max)} onChange={(value) => setDraft({ ...draft, max: Number(value) || 0 })} />
          </div>
          <Field label="Etiqueta" value={draft.label} onChange={(value) => setDraft({ ...draft, label: value })} />
          <TextArea label="Interpretación" value={draft.text} onChange={(value) => setDraft({ ...draft, text: value })} />
          <TextArea label="Recomendación" value={draft.recommendation} onChange={(value) => setDraft({ ...draft, recommendation: value })} />
          <TextArea label="Pregunta sugerida de entrevista" value={draft.interviewQuestion} onChange={(value) => setDraft({ ...draft, interviewQuestion: value })} />
          <Primary
            disabled={!editable || !facetCode}
            onClick={() => {
              onSave(facetCode, { ...draft, facetCode });
              setDraft({ id: '', facetCode, min: 0, max: 20, label: '', text: '', recommendation: '', interviewQuestion: '', active: true });
            }}
          >
            Guardar rango
          </Primary>
        </div>
      </Panel>
    </div>
  );
}

function VersionsSection({ assessment, detail, onClone, busy }: { assessment?: Assessment; detail: VersionDetail | null; onClone: () => void; busy: boolean }) {
  return (
    <Panel title="Versionado científico">
      <div className="grid gap-3">
        {(assessment?.versions || []).map((version) => (
          <article key={version.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold text-white">v{version.version}</p>
                <p className="text-xs text-slate-500">Publicada: {formatDate(version.publishedAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={version.status} />
                <Link className="text-xs font-semibold text-indigo-300" href={`/staff/admin/evaluations/versions/${version.id}`}>
                  Detalle técnico
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-4">
        <Primary disabled={busy || !detail || !['PUBLISHED', 'ACTIVE'].includes(detail.status)} onClick={onClone}>
          Duplicar versión publicada
        </Primary>
      </div>
    </Panel>
  );
}

function PublicationSection({ detail, onWorkflow, busy }: { detail: VersionDetail | null; onWorkflow: (action: string) => void; busy: boolean }) {
  return <Panel title="Publicación controlada"><Readiness readiness={detail?.readiness} /><div className="mt-4 flex flex-wrap gap-2"><Primary disabled={busy || !detail} onClick={() => onWorkflow('request_internal_review')}>Enviar a revisión interna</Primary><Primary disabled={busy || !detail} onClick={() => onWorkflow('request_psychologist_review')}>Revisión psicológica</Primary><Primary disabled={busy || !detail} onClick={() => onWorkflow('approve')}>Aprobar</Primary><Primary disabled={busy || !detail || detail.readiness?.ready === false} onClick={() => onWorkflow('publish')}>Publicar</Primary><SmallButton disabled={busy || !detail} onClick={() => onWorkflow('return_to_draft')}>Devolver a borrador</SmallButton><SmallButton disabled={busy || !detail} onClick={() => onWorkflow('retire')}>Retirar</SmallButton></div></Panel>;
}

function AuditSection({ history }: { history: AuditEvent[] }) {
  return <Panel title="Auditoría visual"><div className="grid gap-3">{history.length === 0 && <Empty text="No hay eventos editoriales para esta versión." />}{history.map((event) => <article key={event.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4"><p className="font-bold text-white">{event.actor?.name || event.actor?.email || event.actorType}</p><p className="mt-1 text-sm text-slate-300">{event.action}</p><p className="mt-1 text-xs text-slate-500">{formatDate(event.createdAt)}</p></article>)}</div></Panel>;
}

function Readiness({ readiness }: { readiness?: { ready: boolean; blockingIssues: string[]; warnings: string[] } }) { return <div className="rounded-lg border border-slate-800 bg-slate-950 p-4"><p className={`text-sm font-bold ${readiness?.ready ? 'text-emerald-300' : 'text-rose-300'}`}>{readiness?.ready ? 'Lista para publicar' : 'No lista para publicar'}</p><IssueList title="Bloqueos" items={readiness?.blockingIssues || []} tone="rose" /><IssueList title="Advertencias" items={readiness?.warnings || []} tone="amber" /></div>; }
function IssueList({ title, items, tone }: { title: string; items: string[]; tone: 'rose' | 'amber' }) { if (items.length === 0) return null; return <div className="mt-3"><p className={`text-xs font-bold uppercase tracking-wider ${tone === 'rose' ? 'text-rose-300' : 'text-amber-300'}`}>{title}</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-lg border border-slate-800 bg-slate-900 p-5"><h2 className="text-lg font-bold text-white">{title}</h2><div className="mt-4">{children}</div></section>; }
function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'emerald' | 'rose' | 'amber' | 'indigo' }) { const tones = { slate: 'border-slate-700 bg-slate-800 text-slate-200', emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100', rose: 'border-rose-500/40 bg-rose-500/10 text-rose-100', amber: 'border-amber-500/40 bg-amber-500/10 text-amber-100', indigo: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-100' }; return <span className={`rounded-md border px-2 py-1 text-[11px] font-bold ${tones[tone]}`}>{children}</span>; }
function Empty({ text }: { text: string }) { return <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950 p-6 text-center text-sm text-slate-500">{text}</div>; }
function Skeleton() { return <div className="grid gap-4"><div className="h-28 animate-pulse rounded-lg bg-slate-900" /><div className="h-64 animate-pulse rounded-lg bg-slate-900" /></div>; }
function Row({ title, meta }: { title: string; meta: string }) { return <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><p className="text-sm font-bold text-white">{title}</p><p className="mt-1 text-xs text-slate-500">{meta}</p></div>; }
function ListEmpty({ empty, children }: { empty: boolean; children: React.ReactNode }) { return empty ? <Empty text="Sin datos reales todavía." /> : <div className="grid gap-2">{children}</div>; }
function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <label className="block"><span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} required={required} className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400" /></label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-28 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400" /></label>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) { return <label className="block"><span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400"><option value="">Seleccionar</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> {label}</label>; }
function Primary({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) { return <button type={onClick ? 'button' : 'submit'} onClick={onClick} disabled={disabled} className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-100 hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">{children}</button>; }
function SmallButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) { return <button type="button" onClick={onClick} disabled={disabled} className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-50">{children}</button>; }
