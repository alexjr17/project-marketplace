import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Play, Check, SkipForward, Ban, Package, Printer, Boxes, Replace, ChevronDown, RotateCcw, Pencil, Save, ClipboardList, Layers, Gauge, CalendarDays } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgProductionOrder, MfgWorkshop, MfgWarehouse, MfgStageStatus, MfgProductionOrderStage, MfgOrderMaterial, MfgInput, MfgReference, MfgCollection } from '../../types/manufacturing';
import { STATUS_META } from './ProductionOrdersPage';
import {
  Page, PageHeader, Button, IconButton, Card, CardTitle, StatCard, Badge, Tabs, DescriptionList, Alert,
  Field, TextInput, TextArea, SelectInput, DateInput, Combobox, Checkbox, FormGrid, FormActions, SearchInput,
  Dialog, Drawer, Spinner, EmptyState, useConfirm, type Tone,
} from '../../components/ui';
import QtyMatrix from '../../components/manufacturing/QtyMatrix';
import { MarketBadge } from '../../components/manufacturing/mfgUi';

import { errorMessage } from '../../lib/http';
const STAGE_META: Record<MfgStageStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Pendiente', tone: 'gray' },
  IN_PROCESS: { label: 'En proceso', tone: 'yellow' },
  COMPLETED: { label: 'Completada', tone: 'green' },
  SKIPPED: { label: 'Omitida', tone: 'gray' },
};

// Círculo de secuencia por estado.
const STAGE_CIRCLE: Record<MfgStageStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-500',
  IN_PROCESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  SKIPPED: 'bg-gray-100 text-gray-400',
};

const fmt = (dt?: string | null) => (dt ? new Date(dt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '');

export default function ProductionOrderDetailPage() {
  const { id } = useParams();
  const ask = useConfirm();
  const orderId = Number(id);

  const [order, setOrder] = useState<MfgProductionOrder | null>(null);
  const [workshops, setWorkshops] = useState<MfgWorkshop[]>([]);
  const [warehouses, setWarehouses] = useState<MfgWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Etapa abierta (acordeón) + su edición en línea.
  const [stage, setStage] = useState<MfgProductionOrderStage | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [stageTab, setStageTab] = useState<'general' | 'matrix' | 'consumption' | 'components'>('general');
  const [cells, setCells] = useState<Record<number, Record<number, string>>>({}); // [sizeId][colorId]=qty
  const [wsId, setWsId] = useState<number | ''>('');
  const [assignee, setAssignee] = useState('');
  const [stNotes, setStNotes] = useState('');
  const [destWhId, setDestWhId] = useState<number | ''>('');
  const [realCons, setRealCons] = useState<Record<string, string>>({}); // `${inputId}-${colorId||0}` = cantidad real
  const [stageComps, setStageComps] = useState<Record<number, number | ''>>({}); // componentId → workshopId

  // Card de control del timeline: filtro por estado, búsqueda y avance.
  const [filterStatus, setFilterStatus] = useState<'all' | MfgStageStatus>('all');
  const [query, setQuery] = useState('');

  // Modo edición: reutiliza el flujo del formulario de creación.
  const [editing, setEditing] = useState(false);
  const [refs, setRefs] = useState<MfgReference[]>([]);
  const [editRefId, setEditRefId] = useState<number | ''>('');
  const [editRef, setEditRef] = useState<MfgReference | null>(null);
  const [editLoadingRef, setEditLoadingRef] = useState(false);
  const [editWarehouseId, setEditWarehouseId] = useState<number | ''>('');
  const [editNotes, setEditNotes] = useState('');
  const [editQty, setEditQty] = useState<Record<number, Record<number, string>>>({});
  const [editSaving, setEditSaving] = useState(false);

  // Campos de cabecera (paridad con fabrica-ropa).
  const [collections, setCollections] = useState<MfgCollection[]>([]);
  const [editCollectionId, setEditCollectionId] = useState<number | ''>('');
  const [editInternalCode, setEditInternalCode] = useState('');
  const [editScheduledAt, setEditScheduledAt] = useState('');
  const [editEstimatedDeliveryAt, setEditEstimatedDeliveryAt] = useState('');

  const startEdit = async () => {
    if (!order) return;
    setEditing(true);
    try {
      const [allRefs, current, cols] = await Promise.all([
        manufacturingService.getReferences(),
        manufacturingService.getReference(order.referenceId),
        manufacturingService.getCollections(),
      ]);
      setRefs(allRefs);
      setEditRefId(order.referenceId);
      setEditRef(current);
      setEditWarehouseId(order.warehouseId ?? '');
      setEditNotes(order.notes ?? '');
      setCollections(cols);
      setEditCollectionId(order.collectionId ?? '');
      setEditInternalCode(order.internalCode ?? '');
      setEditScheduledAt(order.scheduledAt ? order.scheduledAt.slice(0, 10) : '');
      setEditEstimatedDeliveryAt(order.estimatedDeliveryAt ? order.estimatedDeliveryAt.slice(0, 10) : '');
      // Pre-carga de la matriz desde los ítems de la orden.
      const q: Record<number, Record<number, string>> = {};
      order.items.forEach((it) => { (q[it.sizeId] ||= {})[it.colorId] = String(it.quantity); });
      setEditQty(q);
    } catch {
      toast.error('No se pudo preparar la edición');
      setEditing(false);
    }
  };

  const onEditReferenceChange = async (value: number | '') => {
    setEditRefId(value);
    setEditRef(null);
    setEditQty({});
    if (value === '') return;
    setEditLoadingRef(true);
    try { setEditRef(await manufacturingService.getReference(Number(value))); }
    catch { toast.error('No se pudo cargar la referencia'); }
    finally { setEditLoadingRef(false); }
  };

  const editSizes = useMemo(() => (editRef?.sizes ?? []).map((s) => s.size!).filter(Boolean).sort((a, b) => a.sortOrder - b.sortOrder), [editRef]);
  const editColors = useMemo(() => (editRef?.colors ?? []).map((c) => c.color!).filter(Boolean), [editRef]);
  const editTotal = useMemo(() => {
    let t = 0; for (const s of Object.values(editQty)) for (const v of Object.values(s)) t += Number(v) || 0; return t;
  }, [editQty]);

  const setEditCell = (sizeId: number, colorId: number, val: string) =>
    setEditQty((prev) => ({ ...prev, [sizeId]: { ...(prev[sizeId] ?? {}), [colorId]: val } }));

  const saveEdit = async () => {
    if (!order) return;
    if (editRefId === '') { toast.error('Selecciona una referencia'); return; }
    const items: { colorId: number; sizeId: number; quantity: number }[] = [];
    for (const s of editSizes) for (const c of editColors) {
      const q = Number(editQty[s.id]?.[c.id] ?? 0);
      if (q > 0) items.push({ colorId: c.id, sizeId: s.id, quantity: q });
    }
    if (items.length === 0) { toast.error('Ingresa al menos una cantidad'); return; }

    setEditSaving(true);
    try {
      await manufacturingService.updateProductionOrder(orderId, {
        referenceId: Number(editRefId),
        warehouseId: editWarehouseId === '' ? null : Number(editWarehouseId),
        collectionId: editCollectionId === '' ? null : Number(editCollectionId),
        internalCode: editInternalCode.trim() || null,
        scheduledAt: editScheduledAt || null,
        estimatedDeliveryAt: editEstimatedDeliveryAt || null,
        notes: editNotes.trim() || null,
        items,
      });
      toast.success('Orden actualizada');
      setEditing(false);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar la orden');
    } finally {
      setEditSaving(false);
    }
  };

  // Modal de PDF (previsualización en iframe) — PDF real del backend (dompdf).
  const [pdfModal, setPdfModal] = useState<{ title: string; stageId: number; componentId?: number; includeInputs: boolean; url: string; loading: boolean } | null>(null);

  const openStagePdf = async (st: MfgProductionOrderStage, component?: { id: number; label: string }) => {
    const title = component
      ? `${st.process?.type === 'EXTERNAL' ? 'Solicitud' : 'Reporte'} · ${st.process?.name ?? 'Etapa'} — Componente: ${component.label}`
      : `${st.process?.type === 'EXTERNAL' ? 'Solicitud' : 'Reporte'} · ${st.process?.name ?? 'Etapa'}`;
    setPdfModal({ title, stageId: st.id, componentId: component?.id, includeInputs: true, url: '', loading: true });
    try {
      const blob = await manufacturingService.getStagePdf(orderId, st.id, true, component?.id);
      setPdfModal((prev) => ({ title: prev?.title ?? '', stageId: st.id, componentId: component?.id, includeInputs: true, url: URL.createObjectURL(blob), loading: false }));
    } catch {
      toast.error('No se pudo cargar el PDF');
      setPdfModal(null);
    }
  };

  const reloadStagePdf = async (includeInputs: boolean) => {
    setPdfModal((prev) => (prev ? { ...prev, includeInputs, loading: true } : prev));
    const m = pdfModal;
    if (!m) return;
    try {
      const blob = await manufacturingService.getStagePdf(orderId, m.stageId, includeInputs, m.componentId);
      setPdfModal((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return { ...m, includeInputs, url: URL.createObjectURL(blob), loading: false };
      });
    } catch {
      toast.error('No se pudo cargar el PDF');
      setPdfModal((prev) => (prev ? { ...prev, loading: false } : prev));
    }
  };

  const closePdf = () => {
    setPdfModal((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  // Panel de materiales / sustituciones.
  const [matModal, setMatModal] = useState(false);
  const [mats, setMats] = useState<MfgOrderMaterial[]>([]);
  const [matTotal, setMatTotal] = useState(0);
  const [allInputs, setAllInputs] = useState<MfgInput[]>([]);
  const [matLoading, setMatLoading] = useState(false);

  const openMaterials = async () => {
    setMatModal(true); setMatLoading(true);
    try {
      const [m, ins] = await Promise.all([manufacturingService.getOrderMaterials(orderId), manufacturingService.getInputs()]);
      setMats(m.materials); setMatTotal(m.total); setAllInputs(ins);
    } catch { toast.error('No se pudieron cargar los materiales'); }
    finally { setMatLoading(false); }
  };
  const refreshMaterials = async () => { try { const m = await manufacturingService.getOrderMaterials(orderId); setMats(m.materials); setMatTotal(m.total); } catch { /* noop */ } };
  const substitute = async (m: MfgOrderMaterial, substituteInputId: number | '') => {
    try {
      if (substituteInputId === '') {
        // Buscar y quitar la sustitución existente.
        const sub = order?.substitutions?.find((s) => s.originalInputId === m.input?.id && (s.colorId ?? null) === (m.color?.id ?? null));
        if (sub) await manufacturingService.deleteSubstitution(orderId, sub.id);
      } else {
        await manufacturingService.saveSubstitution(orderId, { originalInputId: m.input!.id, substituteInputId: Number(substituteInputId), colorId: m.color?.id ?? null });
      }
      await Promise.all([refreshMaterials(), load()]);
      toast.success('Actualizado');
    } catch { toast.error('No se pudo aplicar la sustitución'); }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [o, ws, whs] = await Promise.all([manufacturingService.getProductionOrder(orderId), manufacturingService.getWorkshops(), manufacturingService.getWarehouses()]);
      setOrder(o); setWorkshops(ws); setWarehouses(whs);
    } catch { toast.error('No se pudo cargar la orden'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orderId]);

  // Diccionarios color/talla desde los ítems de la orden.
  const colorMap = useMemo(() => {
    const m = new Map<number, { id: number; name: string; hexCode: string }>();
    order?.items.forEach((it) => it.color && m.set(it.colorId, it.color));
    return m;
  }, [order]);
  const sizeMap = useMemo(() => {
    const m = new Map<number, { id: number; name: string; abbreviation: string; sortOrder: number }>();
    order?.items.forEach((it) => it.size && m.set(it.sizeId, it.size));
    return m;
  }, [order]);

  const stages = useMemo(() => (order ? [...order.stages].sort((a, b) => a.sequence - b.sequence) : []), [order]);
  const lastSeq = useMemo(() => (stages.length ? Math.max(...stages.map((s) => s.sequence)) : 0), [stages]);
  const doneStages = stages.filter((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED').length;
  const pctStages = stages.length ? Math.round((doneStages / stages.length) * 100) : 0;
  const totalQty = order?.items.reduce((t, it) => t + it.quantity, 0) ?? 0;
  const locked = order?.status === 'CANCELLED' || order?.status === 'COMPLETED';

  const progOf = (st: MfgProductionOrderStage) => (st.programmed ?? []).reduce((t, c) => t + c.quantity, 0);
  const pct = (st: MfgProductionOrderStage) => { const p = progOf(st); return p ? Math.round((st.quantityDone / p) * 100) : 0; };

  // Card de control: conteos por estado, promedio de avance y filtros.
  const stageCounts = useMemo(() => {
    const c: Record<string, number> = { all: stages.length, PENDING: 0, IN_PROCESS: 0, COMPLETED: 0, SKIPPED: 0 };
    stages.forEach((s) => { c[s.status] = (c[s.status] ?? 0) + 1; });
    return c;
  }, [stages]);
  const avgPct = useMemo(() => {
    // Promedio de avance de las etapas (las omitidas no cuentan).
    const ps = stages
      .filter((s) => s.status !== 'SKIPPED')
      .map((s) => { const p = progOf(s); return p ? Math.round((s.quantityDone / p) * 100) : 0; });
    return ps.length ? Math.round(ps.reduce((a, b) => a + b, 0) / ps.length) : 0;
  }, [stages]);
  const filteredStages = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stages.filter((s) =>
      (filterStatus === 'all' || s.status === filterStatus) &&
      (!q || (s.process?.name ?? '').toLowerCase().includes(q))
    );
  }, [stages, filterStatus, query]);

  // Si la etapa abierta queda fuera del filtro/búsqueda, se cierra.
  useEffect(() => {
    if (stage && !filteredStages.some((s) => s.id === stage.id)) closeStage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredStages]);

  const openStage = (st: MfgProductionOrderStage, ro: boolean) => {
    setStage(st); setReadOnly(ro); setStageTab('general');
    setWsId(st.workshopId ?? ''); setAssignee(st.assignee ?? ''); setStNotes(st.notes ?? '');
    setDestWhId(order?.warehouseId ?? '');
    // Pre-carga: celdas guardadas si existen, si no la programada.
    const map: Record<number, Record<number, string>> = {};
    const source = (st.cells && st.cells.length) ? st.cells.map((c) => ({ colorId: c.colorId, sizeId: c.sizeId, quantity: c.quantity })) : (st.programmed ?? []);
    source.forEach((c) => { (map[c.sizeId] ||= {})[c.colorId] = String(c.quantity); });
    setCells(map);
    // Consumo real: pre-carga desde lo ya registrado.
    const rc: Record<string, string> = {};
    (st.consumptions ?? []).forEach((c) => { rc[`${c.inputId}-${c.colorId ?? 0}`] = String(c.realQty); });
    setRealCons(rc);
    // Taller por componente (etapa externa): pre-carga.
    const sc: Record<number, number | ''> = {};
    (order?.reference?.components ?? []).forEach((cmp) => { sc[cmp.id] = ''; });
    (st.stageComponents ?? []).forEach((x) => { sc[x.componentId] = x.workshopId ?? ''; });
    setStageComps(sc);
  };
  const closeStage = () => setStage(null);
  const toggleStage = (st: MfgProductionOrderStage) => {
    if (stage?.id === st.id) { closeStage(); return; }
    openStage(st, locked || st.status === 'COMPLETED' || st.status === 'SKIPPED');
  };

  // Colores/tallas presentes en la matriz de la etapa abierta.
  const stageColors = useMemo(() => {
    if (!stage) return [];
    const ids = [...new Set((stage.programmed ?? []).map((c) => c.colorId))];
    return ids.map((cid) => colorMap.get(cid)).filter(Boolean) as { id: number; name: string; hexCode: string }[];
  }, [stage, colorMap]);
  const stageSizes = useMemo(() => {
    if (!stage) return [];
    const ids = [...new Set((stage.programmed ?? []).map((c) => c.sizeId))];
    return ids.map((sid) => sizeMap.get(sid)).filter(Boolean).sort((a, b) => a!.sortOrder - b!.sortOrder) as { id: number; abbreviation: string; sortOrder: number }[];
  }, [stage, sizeMap]);
  const progMap = useMemo(() => {
    const m: Record<number, Record<number, number>> = {};
    (stage?.programmed ?? []).forEach((c) => { (m[c.sizeId] ||= {})[c.colorId] = c.quantity; });
    return m;
  }, [stage]);
  const progTotal = useMemo(() => (stage?.programmed ?? []).reduce((t, c) => t + c.quantity, 0), [stage]);

  const setCell = (sizeId: number, colorId: number, v: string) =>
    setCells((prev) => ({ ...prev, [sizeId]: { ...(prev[sizeId] ?? {}), [colorId]: v } }));
  const cellsTotal = useMemo(() => {
    let t = 0; for (const r of Object.values(cells)) for (const v of Object.values(r)) t += Number(v) || 0; return t;
  }, [cells]);

  const buildCells = () => {
    const out: { colorId: number; sizeId: number; quantity: number }[] = [];
    stageSizes.forEach((s) => stageColors.forEach((c) => {
      const q = Number(cells[s.id]?.[c.id] ?? 0);
      if (q > 0) out.push({ colorId: c.id, sizeId: s.id, quantity: q });
    }));
    return out;
  };

  const setRC = (inputId: number, colorId: number | null | undefined, v: string) =>
    setRealCons((prev) => ({ ...prev, [`${inputId}-${colorId ?? 0}`]: v }));
  const buildConsumptions = () =>
    (stage?.consumptions ?? []).map((c) => ({
      inputId: c.inputId,
      colorId: c.colorId ?? null,
      realQty: Number(realCons[`${c.inputId}-${c.colorId ?? 0}`] ?? c.realQty) || 0,
    }));

  const saveStage = async (status: MfgStageStatus) => {
    if (!stage) return;
    // Etapa externa: el taller es obligatorio. Con componentes se asigna por
    // componente (pestaña Componentes); sin componentes, taller único.
    if (stage.process?.type === 'EXTERNAL' && status === 'IN_PROCESS') {
      const comps = order?.reference?.components ?? [];
      if (comps.length > 0) {
        const missing = comps.filter((c) => !stageComps[c.id]);
        if (missing.length > 0) {
          toast.error(`Asigna el taller de cada componente para iniciar la etapa externa${missing.length ? ` (${missing.map((c) => (c.position === 'SUPERIOR' ? 'Superior' : 'Inferior')).join(', ')})` : ''}`);
          return;
        }
      } else if (wsId === '') {
        toast.error('Asigna un taller para iniciar una etapa externa');
        return;
      }
    }
    setBusy(true);
    try {
      const updated = await manufacturingService.updateStage(orderId, stage.id, {
        status,
        workshopId: wsId === '' ? null : Number(wsId),
        assignee: assignee.trim() || null,
        notes: stNotes.trim() || null,
        warehouseId: (stage.sequence === lastSeq && status === 'COMPLETED' && destWhId !== '') ? Number(destWhId) : undefined,
        cells: buildCells(),
        consumptions: (stage.consumptions && stage.consumptions.length) ? buildConsumptions() : undefined,
        stageComponents: stage.process?.type === 'EXTERNAL'
          ? Object.entries(stageComps).map(([cid, wid]) => ({ componentId: Number(cid), workshopId: wid === '' ? null : Number(wid) }))
          : undefined,
      });
      setOrder(updated); closeStage();
      toast.success(status === 'COMPLETED' ? 'Etapa completada' : 'Etapa guardada');
    } catch (e) { toast.error(errorMessage(e, 'No se pudo guardar')); }
    finally { setBusy(false); }
  };

  const quickPatch = async (st: MfgProductionOrderStage, status: MfgStageStatus) => {
    setBusy(true);
    try { setOrder(await manufacturingService.updateStage(orderId, st.id, { status })); closeStage(); }
    catch { toast.error('No se pudo actualizar'); }
    finally { setBusy(false); }
  };

  const cancelOrder = async () => {
    if (!(await ask({ title: '¿Cancelar esta orden de producción?', message: 'La orden queda cancelada y no podrá avanzar.', confirmText: 'Cancelar orden', cancelText: 'Volver', tone: 'danger' }))) return;
    try { setOrder(await manufacturingService.changeOrderStatus(orderId, 'CANCELLED')); toast.success('Orden cancelada'); }
    catch { toast.error('No se pudo cancelar'); }
  };

  if (loading) return <Page><Spinner label="Cargando…" /></Page>;
  if (!order) return <Page><PageHeader icon={ClipboardList} title="Orden de producción" backTo="/manufacturing/orders" /><Card><EmptyState title="Orden no encontrada" /></Card></Page>;

  const refColors = [...colorMap.values()];
  const refSizes = [...sizeMap.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  const qtyInput = 'w-16 h-8 rounded-md border border-gray-300 px-2 text-right text-sm tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500 disabled:bg-gray-50 disabled:text-gray-500';
  const stageMatrix = (editable: boolean) => (
    <QtyMatrix
      totals
      corner="Talla"
      sizes={stageSizes.map((s) => ({ id: s.id, label: s.abbreviation }))}
      colors={stageColors.map((c) => ({ id: c.id, name: c.name, hex: c.hexCode }))}
      get={(sid, cid) => (editable ? Number(cells[sid]?.[cid] ?? 0) || 0 : progMap[sid]?.[cid] ?? 0)}
      cell={editable ? (sid, cid) => (
        <input type="number" min="0" value={cells[sid]?.[cid] ?? ''} disabled={readOnly} onChange={(e) => setCell(sid, cid, e.target.value)}
          aria-label="Cantidad" placeholder="0" className={qtyInput} />
      ) : undefined}
    />
  );

  const chips = [
    { k: 'all', label: 'Todas' },
    { k: 'IN_PROCESS', label: 'En proceso' },
    { k: 'PENDING', label: 'Pendientes' },
    { k: 'COMPLETED', label: 'Completadas' },
    { k: 'SKIPPED', label: 'Omitidas' },
  ] as const;

  return (
    <Page>
      <PageHeader
        icon={ClipboardList}
        backTo="/manufacturing/orders"
        title={<span className="inline-flex items-center gap-3"><span className="font-mono">{order.code}</span><Badge tone={STATUS_META[order.status].tone}>{STATUS_META[order.status].label}</Badge></span>}
        subtitle={order.reference ? `${order.reference.code} · ${order.reference.name}` : undefined}
        actions={<>
          {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
            <Button variant="secondary" icon={<Ban className="w-4 h-4" />} onClick={cancelOrder}>Cancelar orden</Button>
          )}
          <Button variant="secondary" icon={<Boxes className="w-4 h-4" />} onClick={openMaterials}>Ver materiales</Button>
          {!locked && !editing && <Button variant="outline" icon={<Pencil className="w-4 h-4" />} onClick={startEdit}>Editar orden</Button>}
        </>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Package} label="Unidades" value={totalQty.toLocaleString('es-CO')} />
        <StatCard icon={Layers} tone="blue" label="Etapas" value={`${doneStages}/${stages.length}`} hint={`${pctStages}% completado`} hintTone={pctStages === 100 ? 'green' : 'gray'} />
        <StatCard icon={Gauge} tone={avgPct >= 100 ? 'green' : 'yellow'} label="Avance promedio" value={`${avgPct}%`} hint="Cantidades de las etapas" />
        <StatCard icon={CalendarDays} tone="gray" label="Entrega estimada" value={order.estimatedDeliveryAt?.slice(0, 10) ?? '—'} hint={order.scheduledAt ? `Programada ${order.scheduledAt.slice(0, 10)}` : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
        {/* ───────── Columna izquierda: referencia ───────── */}
        <aside className="lg:sticky lg:top-4 space-y-5">
          <Card padded={false}>
            {order.reference?.imagePath
              ? <img src={order.reference.imagePath} alt={order.reference.name} className="w-full h-44 object-cover" />
              : <div className="w-full h-44 bg-gray-50 flex items-center justify-center text-gray-300"><Package className="w-10 h-10" /></div>}
            <div className="p-4 space-y-4">
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden" title={`${pctStages}% completado`}><div className="h-full bg-app-600 transition-all" style={{ width: `${pctStages}%` }} /></div>
              <DescriptionList cols={1} items={[
                { label: 'Referencia', value: order.reference ? <><span className="font-mono text-gray-500 mr-1">{order.reference.code}</span>{order.reference.name}</> : null },
                { label: 'Tipo de prenda', value: order.reference?.garmentType?.name },
                { label: 'Mercado', value: <MarketBadge market={order.market} /> },
                ...(order.internalCode ? [{ label: 'Código interno', value: order.internalCode }] : []),
                { label: 'Bodega destino', value: order.warehouse?.name },
                ...(order.notes ? [{ label: 'Notas', value: order.notes }] : []),
              ]} />
              {refColors.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Colores</p>
                  <div className="flex flex-wrap gap-1.5">
                    {refColors.map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-700">
                        <span className="w-2.5 h-2.5 rounded-full border border-gray-300" style={{ backgroundColor: c.hexCode }} />{c.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {refSizes.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Tallas</p>
                  <div className="flex flex-wrap gap-1.5">{refSizes.map((s) => <Badge key={s.id}>{s.abbreviation}</Badge>)}</div>
                </div>
              )}
            </div>
          </Card>

          {/* Lote producido */}
          {order.lots && order.lots.length > 0 && (
            <Card>
              <CardTitle icon={Package}>Lote producido</CardTitle>
              <div className="space-y-3">
                {order.lots.map((lot) => (
                  <div key={lot.id}>
                    <p className="font-mono font-semibold text-gray-900 text-sm">{lot.code}{lot.warehouse ? <span className="ml-1.5 text-xs font-sans text-gray-500">→ {lot.warehouse.name}</span> : ''}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {lot.items.map((i) => <Badge key={i.id} tone="green">{i.color?.name} {i.size?.abbreviation}: {i.quantityProduced}</Badge>)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </aside>

        {/* ───────── Columna derecha: edición o etapas ───────── */}
        <div className="min-w-0 space-y-4">
          {editing ? (
            <Card>
              <CardTitle icon={Pencil}>Editar orden de producción</CardTitle>
              <FormGrid>
                <Field label="Referencia" required>
                  <Combobox options={refs.map((r) => ({ value: r.id, label: `${r.code} · ${r.name}` }))} value={editRefId === '' ? null : editRefId}
                    onChange={(v) => onEditReferenceChange(v === null ? '' : Number(v))} placeholder="Buscar referencia…" clearable={false} />
                </Field>
                <Field label="Bodega destino">
                  <SelectInput value={editWarehouseId} onChange={(e) => setEditWarehouseId(e.target.value === '' ? '' : Number(e.target.value))}>
                    <option value="">— Sin asignar —</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </SelectInput>
                </Field>
                <Field label="Código interno"><TextInput value={editInternalCode} onChange={(e) => setEditInternalCode(e.target.value)} maxLength={50} placeholder="Ej: Corte #45" /></Field>
                <Field label="Colección">
                  <SelectInput value={editCollectionId} onChange={(e) => setEditCollectionId(e.target.value === '' ? '' : Number(e.target.value))}>
                    <option value="">— Sin asignar —</option>
                    {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </SelectInput>
                </Field>
                <Field label="Fecha programada"><DateInput value={editScheduledAt} onChange={(e) => setEditScheduledAt(e.target.value)} /></Field>
                <Field label="Fecha de entrega estimada"><DateInput value={editEstimatedDeliveryAt} onChange={(e) => setEditEstimatedDeliveryAt(e.target.value)} /></Field>
                <Field label="Notas" className="md:col-span-2"><TextArea rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} /></Field>
              </FormGrid>

              <div className="flex items-center justify-between mt-6 mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Cantidades (talla × color)</h3>
                <span className="text-sm text-gray-500">Total: <b className="text-gray-900 tabular-nums">{editTotal.toLocaleString('es-CO')}</b> und</span>
              </div>
              {editLoadingRef ? <Spinner label="Cargando referencia…" />
                : !editRef ? <EmptyState title="Selecciona una referencia" description="Al elegirla verás su matriz." />
                : editSizes.length === 0 || editColors.length === 0 ? <Alert tone="warning">La referencia no tiene colores o tallas en su ficha técnica.</Alert>
                : (
                  <QtyMatrix
                    totals
                    sizes={editSizes.map((s) => ({ id: s.id, label: s.abbreviation }))}
                    colors={editColors.map((c) => ({ id: c.id, name: c.name, hex: c.hexCode }))}
                    get={(sid, cid) => Number(editQty[sid]?.[cid] ?? 0) || 0}
                    cell={(sid, cid) => (
                      <input type="number" min="0" value={editQty[sid]?.[cid] ?? ''} onChange={(e) => setEditCell(sid, cid, e.target.value)} aria-label="Cantidad" placeholder="0" className={`${qtyInput} w-20`} />
                    )}
                  />
                )}

              <FormActions>
                <Button variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button icon={<Save className="w-4 h-4" />} isLoading={editSaving} onClick={saveEdit}>Guardar cambios</Button>
              </FormActions>
            </Card>
          ) : (
            <>
              {/* Control de etapas: filtros por estado y buscador */}
              <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex flex-wrap gap-1.5 flex-1" role="group" aria-label="Filtrar etapas por estado">
                  {chips.map((chip) => {
                    const on = filterStatus === chip.k;
                    return (
                      <button key={chip.k} type="button" aria-pressed={on} onClick={() => setFilterStatus(chip.k)}
                        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-colors ${on ? 'bg-app-50 text-app-700 border-app-300' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                        {chip.label}<span className={on ? 'text-app-600' : 'text-gray-400'}>{stageCounts[chip.k] ?? 0}</span>
                      </button>
                    );
                  })}
                </div>
                <SearchInput value={query} onChange={setQuery} placeholder="Buscar proceso…" className="w-full md:w-64" />
              </div>

              {stages.length === 0 ? (
                <Card><EmptyState icon={Layers} title="Esta orden no tiene etapas" description="Define procesos activos en Configuración → Procesos." /></Card>
              ) : filteredStages.length === 0 ? (
                <Card><EmptyState title="Ninguna etapa coincide con el filtro o la búsqueda" /></Card>
              ) : (
                <div className="space-y-3">
                  {filteredStages.map((st) => {
                    const open = stage?.id === st.id;
                    const prog = progOf(st); const external = st.process?.type === 'EXTERNAL';
                    const hasComps = (order?.reference?.components?.length ?? 0) > 0;
                    const registered = st.status !== 'PENDING';
                    const p = pct(st);
                    return (
                      <div key={st.id} className={`bg-white rounded-xl border overflow-hidden ${open ? 'border-app-300' : 'border-gray-200'}`}>
                        {/* Encabezado clicable */}
                        <div className="flex items-center gap-3 p-4">
                          <button type="button" onClick={() => toggleStage(st)} aria-expanded={open} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                            <span className={`w-9 h-9 rounded-full text-sm font-bold flex items-center justify-center flex-shrink-0 ${STAGE_CIRCLE[st.status]}`}>
                              {st.status === 'COMPLETED' ? <Check className="w-4 h-4" /> : st.status === 'SKIPPED' ? <SkipForward className="w-4 h-4" /> : st.sequence}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-gray-900 truncate">{st.process?.name ?? 'Proceso'}</p>
                                {external && <Badge tone="purple">Externo</Badge>}
                                <Badge tone={STAGE_META[st.status].tone}>{STAGE_META[st.status].label}</Badge>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 truncate">
                                <span className="tabular-nums">{st.quantityDone}/{prog} und · {p}%</span>{st.workshop ? ` · ${st.workshop.name}` : ''}{st.assignee ? ` · ${st.assignee}` : ''}
                              </p>
                              <div className="mt-1.5 h-1 rounded-full bg-gray-100 overflow-hidden max-w-xs"><div className={`h-full ${st.status === 'COMPLETED' ? 'bg-green-500' : 'bg-app-500'}`} style={{ width: `${Math.min(p, 100)}%` }} /></div>
                            </div>
                          </button>
                          <IconButton title="Ver PDF de este proceso" onClick={() => openStagePdf(st)}><Printer className="w-4 h-4" /></IconButton>
                          <IconButton title={open ? 'Cerrar etapa' : 'Abrir etapa'} onClick={() => toggleStage(st)}><ChevronDown className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`} /></IconButton>
                        </div>

                        {/* Cuerpo desplegable */}
                        {open && stage && (
                          <div className="border-t border-gray-100">
                            <div className="px-4">
                              <Tabs
                                value={stageTab}
                                onChange={setStageTab}
                                tabs={[
                                  { value: 'general', label: 'General' },
                                  { value: 'matrix', label: 'Cantidades' },
                                  { value: 'consumption', label: 'Consumo', hidden: (stage.consumptions?.length ?? 0) === 0 },
                                  { value: 'components', label: 'Componentes', hidden: (order.reference?.components?.length ?? 0) === 0 },
                                ]}
                              />
                            </div>

                            <div className="p-4 space-y-4">
                              {/* Pestaña: General */}
                              {stageTab === 'general' && (
                                <>
                                  {(st.startedByName || st.finishedByName) && (
                                    <div className="text-xs text-gray-500 space-y-0.5">
                                      {st.startedByName && <p>Inició: <span className="text-gray-700">{st.startedByName}</span> · {fmt(st.startedAt)}</p>}
                                      {st.finishedByName && <p>Finalizó: <span className="text-gray-700">{st.finishedByName}</span> · {fmt(st.finishedAt)}</p>}
                                    </div>
                                  )}
                                  <FormGrid>
                                    {external && !hasComps && (() => {
                                      const forProc = workshops.filter((w) => w.processes?.some((pp) => pp.id === stage.processId));
                                      return (
                                        <Field label="Taller" required>
                                          <SelectInput value={wsId} disabled={readOnly} onChange={(e) => setWsId(e.target.value === '' ? '' : Number(e.target.value))}>
                                            <option value="">{forProc.length === 0 ? 'Sin talleres para este proceso' : '— Taller —'}</option>
                                            {forProc.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                          </SelectInput>
                                        </Field>
                                      );
                                    })()}
                                    {external && hasComps && (
                                      <div className="md:col-span-2"><Alert tone="info" title="Talleres por componente">Esta referencia tiene componentes: asigna el taller de cada uno en la pestaña Componentes.</Alert></div>
                                    )}
                                    <Field label="Encargado"><TextInput value={assignee} disabled={readOnly} onChange={(e) => setAssignee(e.target.value)} placeholder="Nombre" /></Field>
                                    {st.sequence === lastSeq && (
                                      <Field label="Bodega destino" hint="Al completar, el producto entra aquí." className="md:col-span-2">
                                        <SelectInput value={destWhId} disabled={readOnly} onChange={(e) => setDestWhId(e.target.value === '' ? '' : Number(e.target.value))}>
                                          <option value="">— Bodega —</option>
                                          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </SelectInput>
                                      </Field>
                                    )}
                                    <Field label="Observaciones" className="md:col-span-2"><TextArea rows={2} value={stNotes} disabled={readOnly} onChange={(e) => setStNotes(e.target.value)} /></Field>
                                  </FormGrid>
                                </>
                              )}

                              {/* Pestaña: Cantidades. La primera etapa muestra base + completada; las
                                  siguientes solo la última registrada (la base ya vino de la anterior). */}
                              {stageTab === 'matrix' && (
                                st.sequence === 1 ? (
                                  <div className="grid xl:grid-cols-2 gap-4">
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <p className="text-sm font-medium text-gray-700">Cantidades de la orden</p>
                                        <span className="text-xs text-gray-500">Base: <b className="text-gray-900 tabular-nums">{progTotal}</b></span>
                                      </div>
                                      <p className="text-xs text-gray-500 mb-2">Con la que inicia esta etapa.</p>
                                      {stageMatrix(false)}
                                    </div>
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <p className="text-sm font-medium text-gray-700">{readOnly ? 'Cantidades completadas' : 'Completado (cómo se modifica)'}</p>
                                        <span className="text-xs text-gray-500">Total: <b className="text-gray-900 tabular-nums">{cellsTotal}</b></span>
                                      </div>
                                      <p className="text-xs text-gray-500 mb-2">Puedes completar menos que la base (merma).</p>
                                      {stageMatrix(true)}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="text-sm font-medium text-gray-700">{readOnly ? 'Cantidades completadas' : 'Cantidades (cómo se modifica)'}</p>
                                      <span className="text-xs text-gray-500">Base: <b className="text-gray-900 tabular-nums">{progTotal}</b> · Total: <b className="text-gray-900 tabular-nums">{cellsTotal}</b></span>
                                    </div>
                                    <p className="text-xs text-gray-500 mb-2">Última registrada; la siguiente etapa toma esta matriz. Puedes completar menos que la base (merma).</p>
                                    {stageMatrix(true)}
                                  </div>
                                )
                              )}

                              {/* Pestaña: Consumo de insumos (esperado → real, merma) */}
                              {stageTab === 'consumption' && (stage.consumptions?.length ?? 0) > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-gray-700">Consumo de insumos (esperado → real)</p>
                                  <p className="text-xs text-gray-500 mb-2">El esperado se calcula del BOM × producido. Ajusta el real si hubo merma o desperdicio.</p>
                                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gray-50 border-b border-gray-200"><tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Insumo</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Esperado</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Real</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Diferencia</th>
                                      </tr></thead>
                                      <tbody className="divide-y divide-gray-100">{stage.consumptions!.map((c) => {
                                        const key = `${c.inputId}-${c.colorId ?? 0}`;
                                        const real = Number(realCons[key] ?? c.realQty) || 0;
                                        const diff = real - Number(c.expectedQty);
                                        return (
                                          <tr key={c.id}>
                                            <td className="px-3 py-2 text-gray-900">{c.input?.name}{c.color ? <span className="text-xs text-gray-400"> · {c.color.name}</span> : ''}</td>
                                            <td className="px-3 py-2 text-right text-gray-600 tabular-nums">{Number(c.expectedQty)} <span className="text-xs text-gray-400">{c.input?.unitOfMeasure}</span></td>
                                            <td className="px-3 py-1.5 text-right">
                                              <input type="number" min="0" step="0.0001" disabled={readOnly} value={realCons[key] ?? String(c.realQty)}
                                                onChange={(e) => setRC(c.inputId, c.colorId, e.target.value)} aria-label="Consumo real" className={`${qtyInput} w-24`} />
                                            </td>
                                            <td className={`px-3 py-2 text-right font-medium tabular-nums ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-gray-400'}`}>{diff > 0 ? '+' : ''}{Number(diff.toFixed(4))}</td>
                                          </tr>
                                        );
                                      })}</tbody>
                                      <tfoot>{(() => {
                                        const ce = stage.consumptions!.reduce((t, c) => t + Number(c.expectedQty) * Number(c.unitValue || 0), 0);
                                        const cr = stage.consumptions!.reduce((t, c) => { const r = Number(realCons[`${c.inputId}-${c.colorId ?? 0}`] ?? c.realQty) || 0; return t + r * Number(c.unitValue || 0); }, 0);
                                        const over = cr - ce;
                                        return (
                                          <tr className="border-t border-gray-200 bg-gray-50">
                                            <td className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Costo insumos</td>
                                            <td className="px-3 py-2 text-right text-xs text-gray-700 tabular-nums">${Math.round(ce).toLocaleString('es-CO')}</td>
                                            <td className="px-3 py-2 text-right text-xs text-gray-700 tabular-nums">${Math.round(cr).toLocaleString('es-CO')}</td>
                                            <td className={`px-3 py-2 text-right text-xs font-semibold tabular-nums ${over > 0 ? 'text-red-600' : over < 0 ? 'text-green-600' : 'text-gray-400'}`} title="Sobrecosto por merma">{over > 0 ? '+' : ''}${Math.round(over).toLocaleString('es-CO')}</td>
                                          </tr>
                                        );
                                      })()}</tfoot>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* Pestaña: Componentes — si es externa, taller por componente; si no, solo informativo */}
                              {stageTab === 'components' && (() => {
                                const forProc = workshops.filter((w) => w.processes?.some((pp) => pp.id === stage.processId));
                                return (
                                  <div>
                                    <p className="text-sm font-medium text-gray-700">Talleres por componente</p>
                                    <p className="text-xs text-gray-500 mb-3">Cada componente puede enviarse a un taller distinto; imprime la solicitud de cada uno por separado.</p>
                                    {external ? (
                                      <div className="space-y-2">
                                        {order.reference!.components!.map((cmp) => {
                                          const label = `${cmp.position === 'SUPERIOR' ? 'Superior' : 'Inferior'}${cmp.description ? ` · ${cmp.description}` : ''}`;
                                          return (
                                            <div key={cmp.id} className="flex items-center gap-2 flex-wrap">
                                              <span className="text-sm text-gray-700 min-w-[8rem]">{label}</span>
                                              <div className="flex-1 min-w-[10rem]"><SelectInput value={stageComps[cmp.id] ?? ''} disabled={readOnly} aria-label={`Taller de ${label}`}
                                                onChange={(e) => setStageComps((prev) => ({ ...prev, [cmp.id]: e.target.value === '' ? '' : Number(e.target.value) }))}
                                                >
                                                <option value="">{forProc.length === 0 ? 'Sin talleres para este proceso' : '— Taller —'}</option>
                                                {forProc.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                              </SelectInput></div>
                                              <IconButton title="Ver PDF de este componente" onClick={() => openStagePdf(st, { id: cmp.id, label })}><Printer className="w-4 h-4" /></IconButton>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-500">Etapa interna: no requiere asignación de talleres por componente.</p>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Acciones de la etapa */}
                            <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-2">
                              {!readOnly && (
                                <>
                                  {!registered && !st.canStart && <span className="text-xs text-amber-700 sm:mr-auto">Completa primero las etapas anteriores</span>}
                                  {!registered
                                    ? <Button variant="ghost" icon={<SkipForward className="w-4 h-4" />} disabled={busy} onClick={() => quickPatch(st, 'SKIPPED')}>Omitir</Button>
                                    : <Button variant="ghost" icon={<RotateCcw className="w-4 h-4" />} disabled={busy} onClick={() => quickPatch(st, 'PENDING')}>Reabrir</Button>}
                                  <Button variant="secondary" icon={<Play className="w-4 h-4" />} disabled={busy || (!registered && !st.canStart)} onClick={() => saveStage('IN_PROCESS')}>Guardar en proceso</Button>
                                  <Button variant="success" icon={<Check className="w-4 h-4" />} disabled={busy || (!registered && !st.canStart)} onClick={() => saveStage('COMPLETED')}>Completar</Button>
                                </>
                              )}
                              {readOnly && !locked && registered && (
                                <Button variant="ghost" icon={<RotateCcw className="w-4 h-4" />} disabled={busy} onClick={() => quickPatch(st, 'PENDING')}>Reabrir</Button>
                              )}
                              {readOnly && (locked || !registered) && <span className="text-xs text-gray-500">Solo lectura</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Materiales / sustituciones */}
      <Drawer open={matModal} onClose={() => setMatModal(false)} title="Materiales de la orden" description={`Consumo esperado para ${matTotal} und. Puedes reemplazar un insumo por otro del mismo tipo.`} width="lg">
        {matLoading ? <Spinner label="Cargando…" /> : mats.length === 0 ? <EmptyState icon={Boxes} title="La referencia no tiene materiales" /> : (
          <div className="divide-y divide-gray-100 -my-2">
            {mats.map((m) => {
              const isService = m.input?.inputType?.classification === 'SERVICIO';
              const similar = allInputs.filter((i) => i.inputTypeId === m.input?.inputTypeId && i.id !== m.input?.id);
              return (
                <div key={m.materialId} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-gray-500">{m.input?.code}</span> {m.input?.name}
                      {m.color && <span className="text-xs text-gray-400">· {m.color.name}</span>}
                      {isService && <Badge tone="purple">Servicio</Badge>}
                    </p>
                    <p className="text-xs text-gray-500 tabular-nums">Esperado: {Number(m.expected)} {m.input?.unitOfMeasure} ({Number(m.consumption)}/und)</p>
                    {m.substitute && <p className="text-xs text-amber-700 mt-0.5">Reemplazado por {m.substitute.name}</p>}
                  </div>
                  {!isService && !locked && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Replace className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <SelectInput value={m.substitute?.id ?? ''} onChange={(e) => substitute(m, e.target.value === '' ? '' : Number(e.target.value))} className="sm:w-56" aria-label="Reemplazo">
                        <option value="">Sin reemplazo</option>
                        {similar.map((i) => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}
                      </SelectInput>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Drawer>

      {/* PDF (previsualización + imprimir) — PDF real generado por el backend */}
      <Dialog
        open={!!pdfModal}
        onClose={closePdf}
        size="xl"
        title={<span className="inline-flex items-center gap-2"><Printer className="w-4 h-4 text-gray-500" />{pdfModal?.title}</span>}
        footer={<>
          <div className="sm:mr-auto flex items-center"><Checkbox label="Incluir insumos" checked={pdfModal?.includeInputs ?? true} disabled={pdfModal?.loading} onChange={(e) => reloadStagePdf(e.target.checked)} /></div>
          <Button variant="secondary" onClick={closePdf}>Cerrar</Button>
          <Button icon={<Printer className="w-4 h-4" />} disabled={!pdfModal?.url || pdfModal?.loading} onClick={() => { const f = document.getElementById('pdfPreview') as HTMLIFrameElement | null; f?.contentWindow?.focus(); f?.contentWindow?.print(); }}>Imprimir</Button>
        </>}
      >
        <div className="relative h-[65vh] -mx-5 -my-4 bg-gray-100">
          {pdfModal?.loading && <div className="absolute inset-0 flex items-center justify-center"><Spinner label="Cargando PDF…" /></div>}
          {pdfModal?.url && <iframe id="pdfPreview" title="PDF" src={pdfModal.url} className="w-full h-full" />}
        </div>
      </Dialog>
    </Page>
  );
}
