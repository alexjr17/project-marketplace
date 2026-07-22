import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, Check, SkipForward, Ban, Package, Printer, Boxes, Replace, ChevronDown, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgProductionOrder, MfgWorkshop, MfgWarehouse, MfgStageStatus, MfgProductionOrderStage, MfgOrderMaterial, MfgInput } from '../../types/manufacturing';
import { STATUS_META } from './ProductionOrdersPage';
import { buildReportDoc, reportStage } from './productionReports';

const STAGE_META: Record<MfgStageStatus, { label: string; cls: string }> = {
  PENDING: { label: 'Pendiente', cls: 'bg-gray-100 text-gray-600' },
  IN_PROCESS: { label: 'En proceso', cls: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: 'Completada', cls: 'bg-green-100 text-green-700' },
  SKIPPED: { label: 'Omitida', cls: 'bg-slate-100 text-slate-500' },
};

// Acento por estado (borde izquierdo de la card + círculo de secuencia).
const STAGE_ACCENT: Record<MfgStageStatus, { border: string; circle: string }> = {
  PENDING: { border: 'border-l-gray-300', circle: 'bg-gray-100 text-gray-500' },
  IN_PROCESS: { border: 'border-l-amber-400', circle: 'bg-amber-100 text-amber-700' },
  COMPLETED: { border: 'border-l-green-500', circle: 'bg-green-100 text-green-700' },
  SKIPPED: { border: 'border-l-slate-300', circle: 'bg-slate-100 text-slate-500' },
};

const fmt = (dt?: string | null) => (dt ? new Date(dt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '');

export default function ProductionOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const orderId = Number(id);

  const [order, setOrder] = useState<MfgProductionOrder | null>(null);
  const [workshops, setWorkshops] = useState<MfgWorkshop[]>([]);
  const [warehouses, setWarehouses] = useState<MfgWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Etapa abierta (acordeón) + su edición en línea.
  const [stage, setStage] = useState<MfgProductionOrderStage | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [cells, setCells] = useState<Record<number, Record<number, string>>>({}); // [sizeId][colorId]=qty
  const [wsId, setWsId] = useState<number | ''>('');
  const [assignee, setAssignee] = useState('');
  const [stNotes, setStNotes] = useState('');
  const [destWhId, setDestWhId] = useState<number | ''>('');
  const [realCons, setRealCons] = useState<Record<string, string>>({}); // `${inputId}-${colorId||0}` = cantidad real
  const [stageComps, setStageComps] = useState<Record<number, number | ''>>({}); // componentId → workshopId

  // Modal de PDF (previsualización en iframe).
  const [pdfDoc, setPdfDoc] = useState<{ title: string; html: string } | null>(null);
  const openPdf = (title: string, body: string) => setPdfDoc({ title, html: buildReportDoc(title, body) });

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

  const openStage = (st: MfgProductionOrderStage, ro: boolean) => {
    setStage(st); setReadOnly(ro);
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
    if (stage.process?.type === 'EXTERNAL' && status === 'IN_PROCESS' && wsId === '') { toast.error('Asigna un taller para iniciar una etapa externa'); return; }
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
    } catch (e: any) { toast.error(e?.message || 'No se pudo guardar'); }
    finally { setBusy(false); }
  };

  const quickPatch = async (st: MfgProductionOrderStage, status: MfgStageStatus) => {
    setBusy(true);
    try { setOrder(await manufacturingService.updateStage(orderId, st.id, { status })); closeStage(); }
    catch { toast.error('No se pudo actualizar'); }
    finally { setBusy(false); }
  };

  const cancelOrder = async () => {
    if (!confirm('¿Cancelar esta orden de producción?')) return;
    try { setOrder(await manufacturingService.changeOrderStatus(orderId, 'CANCELLED')); toast.success('Orden cancelada'); }
    catch { toast.error('No se pudo cancelar'); }
  };

  if (loading) return <div className="py-16 text-center text-gray-400">Cargando…</div>;
  if (!order) return <div className="py-16 text-center text-gray-400">Orden no encontrada.</div>;

  const refColors = [...colorMap.values()];
  const refSizes = [...sizeMap.values()].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="max-w-6xl mx-auto">
      <button onClick={() => navigate('/manufacturing/orders')} className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm">
        <ArrowLeft className="w-4 h-4" /> Volver a órdenes
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
        {/* ───────── Columna izquierda: carta de referencia flotante ───────── */}
        <aside className="lg:sticky lg:top-4 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="relative">
              {order.reference?.imagePath
                ? <img src={order.reference.imagePath} alt="ref" className="w-full h-44 object-cover" />
                : <div className="w-full h-44 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-gray-300"><Package className="w-10 h-10" /></div>}
              <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-orange-500 text-white text-[10px] font-bold tracking-wider">REFERENCIA</span>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 font-mono">{order.code}</h1>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_META[order.status].cls}`}>{STATUS_META[order.status].label}</span>
              </div>
              <p className="text-sm text-gray-700 font-medium mt-1">{order.reference ? `${order.reference.code} · ${order.reference.name}` : ''}</p>
              {order.reference?.garmentType?.name && (
                <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-xs text-gray-600">{order.reference.garmentType.name}</span>
              )}

              {refColors.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">Colores</p>
                  <div className="flex flex-wrap gap-1.5">
                    {refColors.map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-xs text-gray-700">
                        <span className="w-2.5 h-2.5 rounded-full border border-gray-300" style={{ backgroundColor: c.hexCode }} />{c.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {refSizes.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">Tallas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {refSizes.map((s) => <span key={s.id} className="px-1.5 py-0.5 rounded bg-gray-100 text-xs font-medium text-gray-700">{s.abbreviation}</span>)}
                  </div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg border border-gray-100 bg-gray-50/60 py-2">
                  <p className="text-lg font-bold text-gray-900">{totalQty}</p>
                  <p className="text-[11px] text-gray-500">unidades</p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50/60 py-2">
                  <p className="text-lg font-bold text-gray-900">{doneStages}/{stages.length}</p>
                  <p className="text-[11px] text-gray-500">etapas</p>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-orange-500 transition-all" style={{ width: `${pctStages}%` }} /></div>
              <p className="text-[11px] text-gray-400 mt-1 text-right">{pctStages}% completado</p>

              {order.warehouse && <p className="text-xs text-gray-500 mt-3">Bodega: {order.warehouse.name}</p>}
              {order.notes && <p className="text-xs text-gray-500 mt-1">Notas: {order.notes}</p>}

              <button onClick={openMaterials} className="mt-4 w-full inline-flex items-center justify-center gap-1.5 text-sm bg-slate-700 hover:bg-slate-800 text-white px-3 py-2 rounded-lg"><Boxes className="w-4 h-4" /> Ver materiales</button>
              {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
                <button onClick={cancelOrder} className="mt-2 w-full inline-flex items-center justify-center gap-1 text-sm text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg border border-red-100"><Ban className="w-4 h-4" /> Cancelar orden</button>
              )}
            </div>
          </div>

          {/* Lote producido */}
          {order.lots && order.lots.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2"><Package className="w-4 h-4 text-green-600" /><h2 className="font-semibold text-gray-900 text-sm">Lote producido</h2></div>
              {order.lots.map((lot) => (
                <div key={lot.id} className="border border-gray-100 rounded-lg p-2.5">
                  <p className="font-mono font-semibold text-gray-800 text-sm">{lot.code}{lot.warehouse ? <span className="ml-1.5 text-[11px] font-sans text-gray-500">→ {lot.warehouse.name}</span> : ''}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {lot.items.map((i) => <span key={i.id} className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 text-[11px]">{i.color?.name} {i.size?.abbreviation}: {i.quantityProduced}</span>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* ───────── Columna derecha: timeline de etapas (acordeones) ───────── */}
        <main className="min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Etapas de producción</h2>
            <span className="text-sm text-gray-400">{doneStages}/{stages.length} completadas</span>
          </div>

          {stages.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">Esta orden no tiene etapas (define procesos activos en Configuración → Procesos).</div>
          ) : (
            <div className="space-y-3">
              {stages.map((st) => {
                const open = stage?.id === st.id;
                const prog = progOf(st); const external = st.process?.type === 'EXTERNAL';
                const registered = st.status !== 'PENDING';
                const accent = STAGE_ACCENT[st.status];
                return (
                  <div key={st.id} className={`bg-white rounded-xl border border-gray-200 border-l-4 ${accent.border} shadow-sm overflow-hidden`}>
                    {/* Encabezado clicable */}
                    <div className="flex items-center gap-3 p-4">
                      <button onClick={() => toggleStage(st)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        <span className={`w-9 h-9 rounded-full text-sm font-bold flex items-center justify-center flex-shrink-0 ${accent.circle}`}>
                          {st.status === 'COMPLETED' ? <Check className="w-4 h-4" /> : st.status === 'SKIPPED' ? <SkipForward className="w-4 h-4" /> : st.sequence}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 truncate">{st.process?.name ?? 'Proceso'}</p>
                            {external && <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-medium">Externo</span>}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_META[st.status].cls}`}>{STAGE_META[st.status].label}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">Avance: {st.quantityDone}/{prog} und · {pct(st)}%{st.workshop ? ` · ${st.workshop.name}` : ''}{st.assignee ? ` · ${st.assignee}` : ''}</p>
                        </div>
                      </button>
                      <button onClick={() => openPdf(`${external ? 'Solicitud' : 'Reporte'} · ${st.process?.name ?? 'Etapa'}`, reportStage(order, st))} title="Ver PDF de este proceso" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg flex-shrink-0"><Printer className="w-4 h-4" /></button>
                      <button onClick={() => toggleStage(st)} className="p-1.5 text-gray-400 hover:text-gray-700 flex-shrink-0"><ChevronDown className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`} /></button>
                    </div>

                    {/* Cuerpo desplegable */}
                    {open && stage && (
                      <div className="border-t border-gray-100 p-4 space-y-4">
                        {/* Trazabilidad */}
                        {(st.startedByName || st.finishedByName) && (
                          <div className="text-[11px] text-gray-400 space-y-0.5">
                            {st.startedByName && <p>Inició: {st.startedByName} · {fmt(st.startedAt)}</p>}
                            {st.finishedByName && <p>Finalizó: {st.finishedByName} · {fmt(st.finishedAt)}</p>}
                          </div>
                        )}

                        {/* Taller / encargado / bodega */}
                        <div className="grid sm:grid-cols-2 gap-3">
                          {external && (() => {
                            const forProc = workshops.filter((w) => w.processes?.some((p) => p.id === stage.processId));
                            return (
                              <label className="block"><span className="text-sm font-medium text-gray-700">Taller</span>
                                <select value={wsId} disabled={readOnly} onChange={(e) => setWsId(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50">
                                  <option value="">{forProc.length === 0 ? 'Sin talleres para este proceso' : '— Taller —'}</option>
                                  {forProc.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                              </label>
                            );
                          })()}
                          <label className="block"><span className="text-sm font-medium text-gray-700">Encargado</span>
                            <input value={assignee} disabled={readOnly} onChange={(e) => setAssignee(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50" placeholder="Nombre" />
                          </label>
                          {st.sequence === lastSeq && (
                            <label className="block sm:col-span-2"><span className="text-sm font-medium text-gray-700">Bodega destino (al completar, el producto entra aquí)</span>
                              <select value={destWhId} disabled={readOnly} onChange={(e) => setDestWhId(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50">
                                <option value="">— Bodega —</option>
                                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                              </select>
                            </label>
                          )}
                        </div>

                        {/* Talleres por componente (etapa externa): cada componente puede ir a otro taller */}
                        {external && (order.reference?.components?.length ?? 0) > 0 && (() => {
                          const forProc = workshops.filter((w) => w.processes?.some((p) => p.id === stage.processId));
                          return (
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">Talleres por componente</p>
                              <p className="text-[11px] text-gray-400 mb-1.5">Cada componente puede enviarse a un taller distinto; el PDF genera una solicitud por componente.</p>
                              <div className="space-y-2">
                                {order.reference!.components!.map((cmp) => (
                                  <div key={cmp.id} className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm text-gray-700 min-w-[8rem]">{cmp.position === 'SUPERIOR' ? 'Superior' : 'Inferior'}{cmp.description ? ` · ${cmp.description}` : ''}</span>
                                    <select value={stageComps[cmp.id] ?? ''} disabled={readOnly}
                                      onChange={(e) => setStageComps((prev) => ({ ...prev, [cmp.id]: e.target.value === '' ? '' : Number(e.target.value) }))}
                                      className="flex-1 min-w-[10rem] border border-gray-300 rounded-lg px-3 py-1.5 text-sm disabled:bg-gray-50">
                                      <option value="">{forProc.length === 0 ? 'Sin talleres para este proceso' : '— Taller —'}</option>
                                      {forProc.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Dos matrices: base (con la que inicia) + completado (cómo se modifica) */}
                        <div className="grid lg:grid-cols-2 gap-4">
                          {/* Base / programada (solo lectura) */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-medium text-gray-700">{st.sequence === 1 ? 'Cantidades de la orden' : 'Viene de la etapa anterior'}</p>
                              <span className="text-xs text-gray-400">Base: <b className="text-gray-600">{progTotal}</b></span>
                            </div>
                            <p className="text-[11px] text-gray-400 mb-1.5">Con la que inicia esta etapa.</p>
                            <div className="overflow-x-auto border border-gray-100 rounded-lg">
                              <table className="text-sm w-full">
                                <thead><tr className="bg-gray-50">
                                  <th className="p-2 text-left text-gray-500 font-medium sticky left-0 bg-gray-50">Talla</th>
                                  {stageColors.map((c) => <th key={c.id} className="p-2 text-center font-medium text-gray-700 min-w-[72px]"><span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: c.hexCode }} />{c.name}</span></th>)}
                                </tr></thead>
                                <tbody>{stageSizes.map((s) => (
                                  <tr key={s.id} className="border-t border-gray-100">
                                    <td className="p-2 font-semibold text-gray-800 sticky left-0 bg-white">{s.abbreviation}</td>
                                    {stageColors.map((c) => { const q = progMap[s.id]?.[c.id] ?? 0; return <td key={c.id} className={`p-2 text-center ${q ? 'text-gray-700' : 'text-gray-300'}`}>{q || '—'}</td>; })}
                                  </tr>
                                ))}</tbody>
                              </table>
                            </div>
                          </div>

                          {/* Completado (editable) */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-medium text-gray-700">{readOnly ? 'Cantidades completadas' : 'Completado (cómo se modifica)'}</p>
                              <span className="text-xs text-gray-500">Total: <b className="text-gray-800">{cellsTotal}</b></span>
                            </div>
                            <p className="text-[11px] text-gray-400 mb-1.5">Puedes completar menos que la base (merma).</p>
                            <div className="overflow-x-auto border border-gray-100 rounded-lg">
                              <table className="text-sm w-full">
                                <thead><tr className="bg-gray-50">
                                  <th className="p-2 text-left text-gray-500 font-medium sticky left-0 bg-gray-50">Talla</th>
                                  {stageColors.map((c) => <th key={c.id} className="p-2 text-center font-medium text-gray-700 min-w-[72px]"><span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: c.hexCode }} />{c.name}</span></th>)}
                                </tr></thead>
                                <tbody>{stageSizes.map((s) => (
                                  <tr key={s.id} className="border-t border-gray-100">
                                    <td className="p-2 font-semibold text-gray-800 sticky left-0 bg-white">{s.abbreviation}</td>
                                    {stageColors.map((c) => (
                                      <td key={c.id} className="p-1.5 text-center">
                                        <input type="number" min="0" value={cells[s.id]?.[c.id] ?? ''} disabled={readOnly}
                                          onChange={(e) => setCell(s.id, c.id, e.target.value)}
                                          className="w-14 border border-gray-300 rounded px-1 py-1 text-center text-sm disabled:bg-gray-50" placeholder="0" />
                                      </td>
                                    ))}
                                  </tr>
                                ))}</tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        {/* Consumo de insumos: esperado → real (merma) */}
                        {stage.consumptions && stage.consumptions.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-1">Consumo de insumos (esperado → real)</p>
                            <p className="text-[11px] text-gray-400 mb-1.5">El esperado se calcula del BOM × producido. Ajusta el <b>real</b> si hubo merma o desperdicio.</p>
                            <div className="overflow-x-auto border border-gray-100 rounded-lg">
                              <table className="text-sm w-full">
                                <thead><tr className="bg-gray-50 text-gray-500">
                                  <th className="p-2 text-left font-medium">Insumo</th>
                                  <th className="p-2 text-right font-medium">Esperado</th>
                                  <th className="p-2 text-center font-medium">Real</th>
                                  <th className="p-2 text-right font-medium">Diferencia</th>
                                </tr></thead>
                                <tbody>{stage.consumptions.map((c) => {
                                  const key = `${c.inputId}-${c.colorId ?? 0}`;
                                  const real = Number(realCons[key] ?? c.realQty) || 0;
                                  const diff = real - Number(c.expectedQty);
                                  return (
                                    <tr key={c.id} className="border-t border-gray-100">
                                      <td className="p-2 text-gray-800">{c.input?.name}{c.color ? <span className="text-xs text-gray-400"> · {c.color.name}</span> : ''}</td>
                                      <td className="p-2 text-right text-gray-600">{Number(c.expectedQty)} <span className="text-xs text-gray-400">{c.input?.unitOfMeasure}</span></td>
                                      <td className="p-1.5 text-center">
                                        <input type="number" min="0" step="0.0001" disabled={readOnly}
                                          value={realCons[key] ?? String(c.realQty)}
                                          onChange={(e) => setRC(c.inputId, c.colorId, e.target.value)}
                                          className="w-24 border border-gray-300 rounded px-1.5 py-1 text-center text-sm disabled:bg-gray-50" />
                                      </td>
                                      <td className={`p-2 text-right font-medium ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-gray-400'}`}>{diff > 0 ? '+' : ''}{Number(diff.toFixed(4))}</td>
                                    </tr>
                                  );
                                })}</tbody>
                                <tfoot>{(() => {
                                  const ce = stage.consumptions!.reduce((t, c) => t + Number(c.expectedQty) * Number(c.unitValue || 0), 0);
                                  const cr = stage.consumptions!.reduce((t, c) => { const r = Number(realCons[`${c.inputId}-${c.colorId ?? 0}`] ?? c.realQty) || 0; return t + r * Number(c.unitValue || 0); }, 0);
                                  const over = cr - ce;
                                  return (
                                    <tr className="border-t border-gray-200 bg-gray-50">
                                      <td className="p-2 text-xs font-medium text-gray-600">Costo insumos</td>
                                      <td className="p-2 text-right text-xs text-gray-600">${Math.round(ce).toLocaleString('es-CO')}</td>
                                      <td className="p-2 text-center text-xs text-gray-600">${Math.round(cr).toLocaleString('es-CO')}</td>
                                      <td className={`p-2 text-right text-xs font-semibold ${over > 0 ? 'text-red-600' : over < 0 ? 'text-green-600' : 'text-gray-400'}`} title="Sobrecosto por merma">{over > 0 ? '+' : ''}${Math.round(over).toLocaleString('es-CO')}</td>
                                    </tr>
                                  );
                                })()}</tfoot>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Observaciones */}
                        <label className="block"><span className="text-sm font-medium text-gray-700">Observaciones</span>
                          <textarea value={stNotes} disabled={readOnly} onChange={(e) => setStNotes(e.target.value)} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50" />
                        </label>

                        {/* Acciones */}
                        <div className="flex flex-wrap justify-end gap-2 pt-1">
                          {!readOnly && (
                            <>
                              {!registered && !st.canStart && <span className="text-xs text-amber-600 self-center mr-auto">Completa primero las etapas anteriores</span>}
                              <button onClick={() => saveStage('IN_PROCESS')} disabled={busy || (!registered && !st.canStart)} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm disabled:opacity-50"><Play className="w-4 h-4" /> Guardar en proceso</button>
                              <button onClick={() => saveStage('COMPLETED')} disabled={busy || (!registered && !st.canStart)} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm disabled:opacity-50"><Check className="w-4 h-4" /> Completar</button>
                              {!registered
                                ? <button onClick={() => quickPatch(st, 'SKIPPED')} disabled={busy} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 text-sm"><SkipForward className="w-4 h-4" /> Omitir</button>
                                : <button onClick={() => quickPatch(st, 'PENDING')} disabled={busy} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-100 text-sm"><RotateCcw className="w-4 h-4" /> Reabrir</button>}
                            </>
                          )}
                          {readOnly && !locked && registered && (
                            <button onClick={() => quickPatch(st, 'PENDING')} disabled={busy} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-100 text-sm"><RotateCcw className="w-4 h-4" /> Reabrir</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Modal de materiales / sustituciones */}
      {matModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setMatModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-900">Materiales de la orden</h2>
              <button onClick={() => setMatModal(false)} className="text-gray-400 hover:text-gray-700 text-sm">Cerrar</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Consumo esperado para {matTotal} und. Puedes reemplazar un insumo por otro parecido del mismo tipo.</p>
            {matLoading ? <div className="py-10 text-center text-gray-400">Cargando…</div> : mats.length === 0 ? <p className="text-sm text-gray-400">La referencia no tiene materiales.</p> : (
              <div className="space-y-2">
                {mats.map((m) => {
                  const isService = m.input?.inputType?.classification === 'SERVICIO';
                  const similar = allInputs.filter((i) => i.inputTypeId === m.input?.inputTypeId && i.id !== m.input?.id);
                  return (
                    <div key={m.materialId} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg p-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800">
                          <span className="font-mono text-gray-500">{m.input?.code}</span> {m.input?.name}
                          {m.color && <span className="ml-1 text-xs text-gray-400">· {m.color.name}</span>}
                          {isService && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px]">Servicio</span>}
                        </p>
                        <p className="text-xs text-gray-400">Esperado: {Number(m.expected)} {m.input?.unitOfMeasure} ({Number(m.consumption)}/und)
                          {m.substitute && <span className="ml-2 text-orange-600">→ reemplazado por {m.substitute.name}</span>}
                        </p>
                      </div>
                      {!isService && !locked && (
                        <div className="flex items-center gap-1.5">
                          <Replace className="w-4 h-4 text-gray-400" />
                          <select value={m.substitute?.id ?? ''} onChange={(e) => substitute(m, e.target.value === '' ? '' : Number(e.target.value))} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm max-w-[12rem]">
                            <option value="">Sin reemplazo</option>
                            {similar.map((i) => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de PDF (previsualización + imprimir) */}
      {pdfDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPdfDoc(null)}>
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900 inline-flex items-center gap-2"><Printer className="w-4 h-4 text-gray-500" /> {pdfDoc.title}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => { const f = document.getElementById('pdfPreview') as HTMLIFrameElement | null; f?.contentWindow?.focus(); f?.contentWindow?.print(); }} className="inline-flex items-center gap-1 text-sm bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg"><Printer className="w-4 h-4" /> Imprimir</button>
                <button onClick={() => setPdfDoc(null)} className="text-gray-400 hover:text-gray-700 text-sm px-2">Cerrar</button>
              </div>
            </div>
            <iframe id="pdfPreview" title="pdf" srcDoc={pdfDoc.html} className="flex-1 w-full bg-gray-100" />
          </div>
        </div>
      )}
    </div>
  );
}
