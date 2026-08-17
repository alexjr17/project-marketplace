import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Pencil, Save, ImageIcon, ChevronDown, Package, Boxes, Layers, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import MultiSelect from '../../components/manufacturing/MultiSelect';
import { socialService } from '../../services/social.service';
import type {
  MfgGarmentType, MfgColor, MfgSize, MfgInput, MfgCollection,
  MfgColorType, MfgMarket, MfgComponentPosition, MfgReferenceInput, MfgInputBatch,
} from '../../types/manufacturing';

const money = (n: number) => '$' + n.toLocaleString('es-CO', { maximumFractionDigits: 2 });

interface ComponentRow { _key: number; position: MfgComponentPosition; description: string; }
interface MaterialRow { inputId: number | ''; colorId: number | ''; componentKey: number | ''; consumptionInitial: string; increment: string; consumption: string; unitValue: string; unitOfMeasure: string; notes: string; }
interface GroupRow { name: string; market: MfgMarket; fixedCostExtra: string; factor: string; listPrice: string; auto: boolean; isWholesale: boolean; sizeIds: number[]; surcharges: Record<number, string>; }

/** Sección plegable reutilizable. */
function Section({ icon, title, subtitle, defaultOpen = true, right, children }: { icon: ReactNode; title: string; subtitle?: string; defaultOpen?: boolean; right?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50">
        <div className="flex items-center gap-3 text-left">
          <div className="p-2 bg-orange-100 rounded-lg text-orange-600">{icon}</div>
          <div>
            <h2 className="font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">{right}<ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} /></div>
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-100 pt-4">{children}</div>}
    </div>
  );
}

export default function ReferenceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = id !== undefined && id !== 'new';
  const refId = isEdit ? Number(id) : 0;
  const keyRef = useRef(1);

  const [tab, setTab] = useState<'summary' | 'edit'>(isEdit ? 'summary' : 'edit');

  const [garmentTypes, setGarmentTypes] = useState<MfgGarmentType[]>([]);
  const [collections, setCollections] = useState<MfgCollection[]>([]);
  const [colors, setColors] = useState<MfgColor[]>([]);
  const [sizes, setSizes] = useState<MfgSize[]>([]);
  const [inputs, setInputs] = useState<MfgInput[]>([]);

  const [codeSuffix, setCodeSuffix] = useState('');
  const [name, setName] = useState('');
  const [garmentTypeId, setGarmentTypeId] = useState<number | ''>('');
  const [collectionId, setCollectionId] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [fixedCost, setFixedCost] = useState('0');
  const [factor, setFactor] = useState('1');
  const [colorState, setColorState] = useState<Record<number, MfgColorType>>({});
  const [selSizes, setSelSizes] = useState<number[]>([]);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  // Lotes por insumo (precio): cache { inputId: {batches, average} }.
  const [batchCache, setBatchCache] = useState<Record<number, { batches: MfgInputBatch[]; average: number }>>({});
  // Borrador del formulario de alta de insumo (arriba); la tabla solo muestra lo agregado.
  const emptyDraft: MaterialRow = { inputId: '', colorId: '', componentKey: '', consumptionInitial: '', increment: '', consumption: '', unitValue: '', unitOfMeasure: '', notes: '' };
  const [draft, setDraft] = useState<MaterialRow>(emptyDraft);
  const [editIdx, setEditIdx] = useState<number | null>(null); // fila en edición en línea

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [gts, cols, cs, ss, ins] = await Promise.all([
          manufacturingService.getGarmentTypes(),
          manufacturingService.getCollections(),
          manufacturingService.getColors(),
          manufacturingService.getSizes(),
          manufacturingService.getInputs(),
        ]);
        setGarmentTypes(gts); setCollections(cols); setColors(cs); setSizes(ss); setInputs(ins);

        if (isEdit) {
          const r = await manufacturingService.getReference(refId);
          setCodeSuffix(r.code.includes('-') ? r.code.substring(r.code.indexOf('-') + 1) : r.code);
          setName(r.name); setGarmentTypeId(r.garmentTypeId ?? ''); setCollectionId(r.collectionId ?? '');
          setDescription(r.description ?? ''); setIsActive(r.isActive); setImagePath(r.imagePath ?? null);
          setFixedCost(String(r.fixedCost ?? 0)); setFactor(String(r.factor ?? 1));
          setColorState(Object.fromEntries(r.colors.map((c) => [c.colorId, c.colorType])));
          setSelSizes(r.sizes.map((s) => s.sizeId));
          const comps: ComponentRow[] = r.components.map((c) => ({ _key: keyRef.current++, position: c.position, description: c.description ?? '' }));
          setComponents(comps);
          const compIdToKey = new Map(r.components.map((c, i) => [c.id, comps[i]._key]));
          setMaterials(r.materials.map((m) => ({
            inputId: m.inputId, colorId: m.colorId ?? '', componentKey: m.componentId ? (compIdToKey.get(m.componentId) ?? '') : '',
            consumptionInitial: m.consumptionInitial != null ? String(m.consumptionInitial) : '', increment: m.increment != null ? String(m.increment) : '',
            consumption: String(m.consumption ?? ''), unitValue: String(m.unitValue ?? ''), unitOfMeasure: m.unitOfMeasure ?? '', notes: m.notes ?? '',
          })));
          setGroups(r.sizeGroups.map((g) => ({
            name: g.name, market: g.market, fixedCostExtra: String(g.fixedCostExtra ?? 0), factor: String(g.factor ?? 1),
            listPrice: String(g.listPrice ?? 0), auto: false, isWholesale: g.isWholesale, sizeIds: g.sizes.map((s) => s.sizeId),
            surcharges: Object.fromEntries(g.surcharges.map((s) => [s.colorId, String(s.amount)])),
          })));
        }
      } catch { toast.error('No se pudieron cargar los datos'); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refId, isEdit]);

  const onGarmentTypeChange = async (value: number | '') => {
    setGarmentTypeId(value);
    const g = garmentTypes.find((x) => x.id === value);
    // Hereda la composición: crea los componentes esperados si aún no hay ninguno.
    if (g?.composition && components.length === 0) {
      const defs: MfgComponentPosition[] = g.composition === 'SET' ? ['SUPERIOR', 'INFERIOR'] : g.composition === 'INFERIOR' ? ['INFERIOR'] : ['SUPERIOR'];
      setComponents(defs.map((position) => ({ _key: keyRef.current++, position, description: '' })));
    }
    // Las tallas de la referencia son las del tipo de prenda (todas, ambos mercados).
    if (g?.sizes) {
      setSelSizes([...new Set(g.sizes.map((s) => s.id))]);
    }
    // Sugiere costo fijo y factor del tipo de prenda (como el indicador de costo de fabrica).
    if (g) {
      if (g.fixedCost !== undefined && g.fixedCost !== null) setFixedCost(String(g.fixedCost));
      if (g.factor !== undefined && g.factor !== null) setFactor(String(g.factor));
    }
    if (!isEdit && value !== '') {
      try {
        const full = await manufacturingService.generateReferenceCode(Number(value));
        setCodeSuffix(full.includes('-') ? full.substring(full.indexOf('-') + 1) : full);
      } catch { setCodeSuffix(''); }
    }
  };

  const compositionLabel: Record<string, string> = { SUPERIOR: 'Superior', INFERIOR: 'Inferior', SET: 'Conjunto' };

  const uploadImg = async (file: File) => {
    setUploading(true);
    try { setImagePath(await socialService.uploadImage(file, 'referencias')); }
    catch { toast.error('No se pudo subir la imagen'); }
    finally { setUploading(false); }
  };

  const refColors = useMemo(() => colors.filter((c) => colorState[c.id]), [colors, colorState]);
  const primaryIds = useMemo(() => colors.filter((c) => colorState[c.id] === 'PRIMARY').map((c) => c.id), [colors, colorState]);
  const secondaryIds = useMemo(() => colors.filter((c) => colorState[c.id] === 'SECONDARY').map((c) => c.id), [colors, colorState]);
  const sizeById = (sid: number) => sizes.find((s) => s.id === sid);
  // Insumos del catálogo agrupados por tipo (para los optgroups del selector).
  const inputsByType = useMemo(() => {
    const groups: Record<string, MfgInput[]> = {};
    inputs.forEach((inp) => { const t = inp.inputType?.name ?? 'Sin tipo'; (groups[t] ||= []).push(inp); });
    return Object.entries(groups);
  }, [inputs]);
  // Insumos agrupados por tipo (para el resumen), con subtotal por grupo.
  const insumoGroups = useMemo(() => {
    const groups: Record<string, { name: string; classification: string; rows: { key: number; name: string; scope?: string | null; detail: string; subtotal: number }[]; subtotal: number }> = {};
    materials.forEach((m, i) => {
      const inp = inputs.find((x) => x.id === m.inputId);
      const typeName = inp?.inputType?.name ?? 'Sin tipo';
      const cls = inp?.inputType?.classification ?? 'PRODUCTO';
      const sub = (Number(m.consumption) || 0) * (Number(m.unitValue) || 0);
      (groups[typeName] ||= { name: typeName, classification: cls, rows: [], subtotal: 0 });
      groups[typeName].rows.push({ key: i, name: inp?.name ?? 'Insumo', scope: inp?.scope, detail: `${m.consumption || 0} ${m.unitOfMeasure || inp?.unitOfMeasure || ''} × ${money(Number(m.unitValue) || 0)}`, subtotal: sub });
      groups[typeName].subtotal += sub;
    });
    return Object.values(groups);
  }, [materials, inputs]);

  // Insumos de la tabla agrupados por tipo (preserva el índice para editar/eliminar).
  const TELA_FIRST = (a: string, b: string) => (a.toLowerCase().includes('tela') ? -1 : b.toLowerCase().includes('tela') ? 1 : 0);
  const materialTableGroups = useMemo(() => {
    const groups: Record<string, { name: string; classification: string; rows: { m: MaterialRow; i: number }[]; subtotal: number }> = {};
    materials.forEach((m, i) => {
      const inp = inputs.find((x) => x.id === m.inputId);
      const typeName = inp?.inputType?.name ?? 'Sin tipo';
      const cls = inp?.inputType?.classification ?? 'PRODUCTO';
      (groups[typeName] ||= { name: typeName, classification: cls, rows: [], subtotal: 0 });
      groups[typeName].rows.push({ m, i });
      groups[typeName].subtotal += (Number(m.consumption) || 0) * (Number(m.unitValue) || 0);
    });
    return Object.values(groups).sort((a, b) => TELA_FIRST(a.name, b.name));
  }, [materials, inputs]);

  const costVariable = useMemo(() => materials.reduce((t, m) => t + (Number(m.consumption) || 0) * (Number(m.unitValue) || 0), 0), [materials]);
  const costUnit = costVariable + (Number(fixedCost) || 0);
  const basePrice = costUnit * (Number(factor) || 0);
  // Indicadores informativos (como fabrica): % costo fijo, ganancia $ y % ganancia.
  const fixedPct = costVariable > 0 ? ((Number(fixedCost) || 0) / costVariable) * 100 : 0;
  const profit = basePrice - costUnit;
  const profitPct = basePrice > 0 ? (1 - costUnit / basePrice) * 100 : 0;
  const groupPrice = (g: GroupRow) => (g.auto || !g.listPrice) ? (costUnit + (Number(g.fixedCostExtra) || 0)) * (Number(g.factor) || 1) : Number(g.listPrice);
  const groupProfitPct = (g: GroupRow) => { const f = Number(g.factor) || 0; return f > 0 ? (1 - 1 / f) * 100 : 0; };

  // Fija el conjunto de colores de un tipo (PRIMARY/SECONDARY); un color solo puede ser uno.
  const setColorsByType = (type: MfgColorType, ids: number[]) =>
    setColorState((prev) => {
      const n = { ...prev };
      Object.keys(n).forEach((k) => { if (n[Number(k)] === type) delete n[Number(k)]; });
      ids.forEach((id) => { n[id] = type; });
      return n;
    });
  const addComponent = () => setComponents([...components, { _key: keyRef.current++, position: 'SUPERIOR', description: '' }]);
  const removeMaterial = (i: number) => { setMaterials(materials.filter((_, idx) => idx !== i)); setEditIdx(null); };

  // Recalcula el consumo final = inicial × (1 + incremento/100) cuando cambian esos campos.
  const recompute = (row: MaterialRow, patch: Partial<MaterialRow>): MaterialRow => {
    const next = { ...row, ...patch };
    if ('consumptionInitial' in patch || 'increment' in patch) {
      const ini = Number(next.consumptionInitial) || 0; const inc = Number(next.increment) || 0;
      if (next.consumptionInitial !== '') next.consumption = String(Number((ini * (1 + inc / 100)).toFixed(4)));
    }
    return next;
  };

  // Trae los lotes de un insumo (cache) y devuelve su promedio.
  const loadBatches = async (inputId: number): Promise<{ batches: MfgInputBatch[]; average: number }> => {
    let data = batchCache[inputId];
    if (!data) {
      try { data = await manufacturingService.getInputBatches(inputId); setBatchCache((c) => ({ ...c, [inputId]: data! })); }
      catch { data = { batches: [], average: 0 }; }
    }
    return data;
  };

  // --- Borrador (form de alta) ---
  const patchDraft = (patch: Partial<MaterialRow>) => setDraft((prev) => recompute(prev, patch));
  const onSelectDraftInput = async (inputId: number | '') => {
    const inp = inputs.find((x) => x.id === inputId);
    patchDraft({ inputId, unitOfMeasure: inp?.unitOfMeasure ?? '', unitValue: '' });
    if (inputId === '') return;
    const data = await loadBatches(Number(inputId));
    if (data.average > 0) patchDraft({ unitValue: String(data.average) });
  };
  const addDraft = () => {
    if (draft.inputId === '') { toast.error('Selecciona un insumo'); return; }
    if (!(Number(draft.consumption) > 0)) { toast.error('Ingresa el consumo'); return; }
    setMaterials([...materials, draft]);
    setDraft(emptyDraft);
  };

  // --- Edición en línea de una fila de la tabla ---
  const patchMaterialAt = (i: number, patch: Partial<MaterialRow>) => setMaterials((prev) => prev.map((x, idx) => idx === i ? recompute(x, patch) : x));
  const startEdit = async (i: number) => { setEditIdx(i); const iid = materials[i].inputId; if (iid !== '') await loadBatches(Number(iid)); };
  const onSelectInputAt = async (i: number, inputId: number | '') => {
    const inp = inputs.find((x) => x.id === inputId);
    patchMaterialAt(i, { inputId, unitOfMeasure: inp?.unitOfMeasure ?? '' });
    if (inputId === '') return;
    const data = await loadBatches(Number(inputId));
    if (data.average > 0) patchMaterialAt(i, { unitValue: String(data.average) });
  };
  const addGroup = () => {
    const g = garmentTypes.find((x) => x.id === garmentTypeId);
    const natIds = (g?.sizes ?? []).filter((s) => (s.pivot?.market ?? 'NATIONAL') === 'NATIONAL').map((s) => s.id);
    setGroups([...groups, { name: '', market: 'NATIONAL', fixedCostExtra: '0', factor, listPrice: '', auto: true, isWholesale: false, sizeIds: natIds, surcharges: {} }]);
  };

  const save = async () => {
    if (garmentTypeId === '') { toast.error('Selecciona el tipo de prenda'); setTab('edit'); return; }
    if (!name.trim()) { toast.error('El nombre es obligatorio'); setTab('edit'); return; }
    if (materials.some((m) => m.inputId === '')) { toast.error('Cada material debe tener un insumo'); setTab('edit'); return; }

    const keyToIdx = new Map(components.map((c, i) => [c._key, i]));
    const gtObj = garmentTypes.find((g) => g.id === garmentTypeId);
    const outCode = (gtObj?.code ? `${gtObj.code}-` : '') + codeSuffix.trim();
    const payload: MfgReferenceInput = {
      name: name.trim(), code: outCode || null, garmentTypeId: Number(garmentTypeId), collectionId: collectionId === '' ? null : Number(collectionId),
      description: description.trim() || null, isActive, imagePath, fixedCost: Number(fixedCost) || 0, factor: Number(factor) || 1,
      colors: Object.entries(colorState).map(([cid, type]) => ({ colorId: Number(cid), type })),
      sizeIds: selSizes,
      components: components.map((c) => ({ position: c.position, description: c.description.trim() || null })),
      materials: materials.map((m) => ({
        inputId: Number(m.inputId), colorId: m.colorId === '' ? null : Number(m.colorId),
        componentIndex: m.componentKey === '' ? null : (keyToIdx.get(Number(m.componentKey)) ?? null),
        consumptionInitial: m.consumptionInitial === '' ? null : Number(m.consumptionInitial),
        increment: Number(m.increment) || 0,
        consumption: Number(m.consumption) || 0, unitValue: Number(m.unitValue) || 0,
        unitOfMeasure: m.unitOfMeasure.trim() || null, notes: m.notes.trim() || null,
      })),
      sizeGroups: groups.map((g) => ({
        name: g.name.trim() || 'Grupo', market: g.market, fixedCostExtra: Number(g.fixedCostExtra) || 0,
        factor: Number(g.factor) || 1, listPrice: g.auto ? 0 : (Number(g.listPrice) || 0), isWholesale: g.isWholesale, sizeIds: g.sizeIds,
        surcharges: Object.entries(g.surcharges).map(([cid, amt]) => ({ colorId: Number(cid), amount: Number(amt) || 0 })).filter((s) => s.amount > 0),
      })),
    };

    setSaving(true);
    try {
      if (isEdit) { await manufacturingService.updateReference(refId, payload); toast.success('Referencia actualizada'); }
      else { await manufacturingService.createReference(payload); toast.success('Referencia creada'); }
      navigate('/manufacturing/references');
    } catch (e: any) { toast.error(e?.message || 'No se pudo guardar'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="py-16 text-center text-gray-400">Cargando…</div>;
  const gt = garmentTypes.find((g) => g.id === garmentTypeId);
  const gtPrefix = gt?.code ? `${gt.code}-` : '';
  const fullCode = gtPrefix + codeSuffix;
  const col = collections.find((c) => c.id === collectionId);
  const sizesForMarket = (market: MfgMarket) => (gt?.sizes ?? []).filter((s) => (s.pivot?.market ?? 'NATIONAL') === market).sort((a, b) => a.sortOrder - b.sortOrder);
  const natSizes = sizesForMarket('NATIONAL');
  const expSizes = sizesForMarket('EXPORT');
  const primary = refColors.filter((c) => colorState[c.id] === 'PRIMARY');
  const secondary = refColors.filter((c) => colorState[c.id] === 'SECONDARY');

  // Fila de la tabla de insumos (modo normal o edición en línea).
  const renderMaterialRow = (m: MaterialRow, i: number) => {
    if (editIdx === i) {
      const eBatch = m.inputId !== '' ? batchCache[Number(m.inputId)] : undefined;
      const eLots = eBatch?.batches ?? [];
      return (
        <tr key={i} className="bg-orange-50/40">
          <td className="px-2 py-2">
            <select value={m.inputId} onChange={(e) => onSelectInputAt(i, e.target.value === '' ? '' : Number(e.target.value))} className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs">
              <option value="">—</option>
              {inputsByType.map(([tn, list]) => <optgroup key={tn} label={tn}>{list.map((inp) => <option key={inp.id} value={inp.id}>{inp.code} · {inp.name}</option>)}</optgroup>)}
            </select>
          </td>
          <td className="px-2 py-2">
            <select value={m.componentKey} onChange={(e) => patchMaterialAt(i, { componentKey: e.target.value === '' ? '' : Number(e.target.value) })} className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs">
              <option value="">—</option>{components.map((c) => <option key={c._key} value={c._key}>{c.position === 'SUPERIOR' ? 'Sup' : 'Inf'}{c.description ? ` · ${c.description}` : ''}</option>)}
            </select>
          </td>
          <td className="px-2 py-2">
            <select value={m.colorId} onChange={(e) => patchMaterialAt(i, { colorId: e.target.value === '' ? '' : Number(e.target.value) })} className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs">
              <option value="">Todos</option>{colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </td>
          <td className="px-2 py-2"><input type="number" step="0.0001" min="0" value={m.consumptionInitial} onChange={(e) => patchMaterialAt(i, { consumptionInitial: e.target.value })} className="w-16 border border-gray-300 rounded px-1.5 py-1 text-xs text-right" /></td>
          <td className="px-2 py-2"><input type="number" step="0.01" min="0" value={m.increment} onChange={(e) => patchMaterialAt(i, { increment: e.target.value })} className="w-14 border border-gray-300 rounded px-1.5 py-1 text-xs text-right" /></td>
          <td className="px-2 py-2"><input type="number" step="0.0001" min="0" value={m.consumption} onChange={(e) => patchMaterialAt(i, { consumption: e.target.value })} className="w-16 border border-orange-300 rounded px-1.5 py-1 text-xs text-right" /></td>
          <td className="px-2 py-2">
            <input type="number" step="0.01" min="0" value={m.unitValue} onChange={(e) => patchMaterialAt(i, { unitValue: e.target.value })} className="w-20 border border-gray-300 rounded px-1.5 py-1 text-xs text-right" />
            {eLots.length > 0 && (
              <select onChange={(e) => { const v = e.target.value; if (v === 'avg') patchMaterialAt(i, { unitValue: String(eBatch!.average) }); else { const b = eLots.find((x) => String(x.id) === v); if (b) patchMaterialAt(i, { unitValue: String(b.unitCost), colorId: b.colorId ?? m.colorId }); } }} value="" className="mt-1 w-full border border-gray-200 rounded px-1 py-0.5 text-[10px]">
                <option value="">lote…</option>
                <option value="avg">Prom · {money(eBatch!.average)}</option>
                {eLots.map((b) => <option key={b.id} value={b.id}>{b.color?.name ? `${b.color.name} · ` : ''}{money(Number(b.unitCost))}</option>)}
              </select>
            )}
          </td>
          <td className="px-2 py-2 text-right font-medium text-gray-800">{money((Number(m.consumption) || 0) * (Number(m.unitValue) || 0))}</td>
          <td className="px-2 py-2 text-right"><button type="button" onClick={() => setEditIdx(null)} className="px-2 py-1 rounded bg-green-600 text-white text-xs">Listo</button></td>
        </tr>
      );
    }
    const inp = inputs.find((x) => x.id === m.inputId);
    const comp = components.find((c) => c._key === m.componentKey);
    const col2 = colors.find((c) => c.id === m.colorId);
    return (
      <tr key={i} className="hover:bg-gray-50">
        <td className="px-3 py-2 text-gray-800">{inp ? `${inp.code} · ${inp.name}` : '—'}</td>
        <td className="px-3 py-2 text-gray-600">{comp ? `${comp.position === 'SUPERIOR' ? 'Sup' : 'Inf'}${comp.description ? ' · ' + comp.description : ''}` : '—'}</td>
        <td className="px-3 py-2 text-gray-600">{col2 ? col2.name : 'Todos'}</td>
        <td className="px-3 py-2 text-right text-gray-600">{m.consumptionInitial || '—'}</td>
        <td className="px-3 py-2 text-right text-gray-600">{m.increment && Number(m.increment) > 0 ? `${m.increment}%` : '—'}</td>
        <td className="px-3 py-2 text-right font-medium text-gray-800">{m.consumption} {m.unitOfMeasure}</td>
        <td className="px-3 py-2 text-right text-gray-600">{money(Number(m.unitValue) || 0)}</td>
        <td className="px-3 py-2 text-right font-medium text-gray-800">{money((Number(m.consumption) || 0) * (Number(m.unitValue) || 0))}</td>
        <td className="px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-0.5">
            <button type="button" onClick={() => startEdit(i)} className="p-1.5 text-gray-400 hover:text-orange-600 rounded-lg"><Pencil className="w-4 h-4" /></button>
            <button type="button" onClick={() => removeMaterial(i)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => navigate('/manufacturing/references')} className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm">
        <ArrowLeft className="w-4 h-4" /> Volver a referencias
      </button>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? (name || 'Referencia') : 'Nueva referencia'}{fullCode && <span className="ml-2 text-base font-mono text-gray-400">{fullCode}</span>}</h1>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium disabled:opacity-60">
          <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {(['summary', 'edit'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'summary' ? 'Resumen' : 'Editar referencia'}
          </button>
        ))}
      </div>

      {/* ======================= RESUMEN ======================= */}
      {tab === 'summary' && (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex gap-5 flex-col sm:flex-row">
              <div className="w-full sm:w-52 flex-shrink-0">
                {imagePath ? <img src={imagePath} alt="ref" className="w-full aspect-square object-cover rounded-xl border border-gray-100" /> : <div className="w-full aspect-square rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-gray-300"><ImageIcon className="w-10 h-10" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-gray-900">{name || '—'}</h2>
                  {fullCode && <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs font-mono">{fullCode}</span>}
                  {gt && <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${gt.composition === 'SET' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{compositionLabel[gt.composition]}</span>}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{isActive ? 'Activa' : 'Inactiva'}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{gt ? gt.name : 'Sin tipo'}{gt?.brand?.name ? ` · ${gt.brand.name}` : ''}{col ? ` · ${col.name}` : ''}</p>

                <div className="mt-3">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Colores</p>
                  <div className="flex flex-wrap gap-1.5">
                    {primary.map((c) => <span key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs"><span className="w-3 h-3 rounded-full border border-white shadow" style={{ backgroundColor: c.hexCode }} />{c.name}</span>)}
                    {secondary.map((c) => <span key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs"><span className="w-3 h-3 rounded-full border border-white shadow" style={{ backgroundColor: c.hexCode }} />{c.name}</span>)}
                    {refColors.length === 0 && <span className="text-sm text-gray-400">—</span>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="bg-gray-50 rounded-lg p-2 text-center"><p className="text-[11px] text-gray-500">Costo insumos</p><p className="font-semibold text-gray-800 text-sm">{money(costVariable)}</p></div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center"><p className="text-[11px] text-gray-500">Costo unidad</p><p className="font-semibold text-gray-800 text-sm">{money(costUnit)}</p></div>
                  <div className="bg-orange-50 rounded-lg p-2 text-center"><p className="text-[11px] text-orange-600">Precio base</p><p className="font-semibold text-orange-700 text-sm">{money(basePrice)}</p></div>
                </div>
                {description && <p className="text-sm text-gray-500 mt-3">{description}</p>}
              </div>
            </div>

            {/* Precios por grupo */}
            <div className="mt-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Precios por grupo de tallas</p>
              {groups.length === 0 ? <p className="text-sm text-gray-400">Sin grupos de precio.</p> : (
                <div className="space-y-2">
                  {groups.map((g, i) => (
                    <div key={i} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">{g.name || 'Grupo'} <span className="text-xs text-gray-400">· {g.market === 'EXPORT' ? 'Exportación' : 'Nacional'}{g.isWholesale ? ' · Mayorista' : ''}</span></p>
                        <div className="flex flex-wrap gap-1 mt-0.5">{g.sizeIds.map((sid) => <span key={sid} className="text-[11px] bg-gray-100 text-gray-600 rounded px-1.5">{sizeById(sid)?.abbreviation}</span>)}</div>
                      </div>
                      <span className="font-semibold text-orange-600">{money(groupPrice(g))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Insumos */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Insumos</h2>
              <span className="text-sm text-gray-500">{money(costVariable)}</span>
            </div>
            {materials.length === 0 ? <p className="text-sm text-gray-400">Sin materiales.</p> : (
              <div className="space-y-3">
                {insumoGroups.map((grp) => (
                  <div key={grp.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {grp.name}
                        {grp.classification === 'SERVICIO' && <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-medium normal-case">Servicio</span>}
                      </span>
                      <span className="text-xs font-medium text-gray-600">{money(grp.subtotal)}</span>
                    </div>
                    <ul className="space-y-1.5">
                      {grp.rows.map((r) => (
                        <li key={r.key} className="flex items-center justify-between text-sm">
                          <div className="min-w-0">
                            <p className="text-gray-800 truncate">{r.name}{r.scope && <span className="ml-1.5 text-[10px] text-gray-400">({r.scope === 'EXTERNAL' ? 'ext.' : 'int.'})</span>}</p>
                            <p className="text-xs text-gray-400">{r.detail}</p>
                          </div>
                          <span className="text-gray-600">{money(r.subtotal)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================= EDITAR ======================= */}
      {tab === 'edit' && (
        <>
          {/* Información del producto */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 rounded-lg text-orange-600"><Package className="w-5 h-5" /></div>
              <h2 className="font-semibold text-gray-900">Información del producto</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-5">
              <div className="sm:col-span-1">
                <span className="text-sm font-medium text-gray-700">Imagen</span>
                <label className="mt-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl aspect-square cursor-pointer hover:bg-gray-50 overflow-hidden">
                  {imagePath ? <img src={imagePath} alt="ref" className="w-full h-full object-cover" /> : <span className="text-gray-400 text-sm flex flex-col items-center gap-2"><ImageIcon className="w-8 h-8" />{uploading ? 'Subiendo…' : 'Subir imagen'}</span>}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImg(e.target.files[0])} />
                </label>
                {imagePath && <button onClick={() => setImagePath(null)} className="mt-1 text-xs text-red-500 hover:underline">Quitar imagen</button>}

                {/* Tallas (solo lectura) — definidas en el tipo de prenda, por mercado */}
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Tallas</p>
                  {!gt ? <p className="text-xs text-gray-400">Selecciona un tipo de prenda.</p> : (
                    <div className="space-y-2">
                      <div>
                        <p className="text-[11px] text-gray-400 mb-1">Nacional</p>
                        <div className="flex flex-wrap gap-1">
                          {natSizes.length ? natSizes.map((s) => <span key={s.id} className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">{s.abbreviation}</span>) : <span className="text-xs text-gray-300">—</span>}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400 mb-1">Exportación</p>
                        <div className="flex flex-wrap gap-1">
                          {expSizes.length ? expSizes.map((s) => <span key={s.id} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium">{s.abbreviation}</span>) : <span className="text-xs text-gray-300">—</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2 grid sm:grid-cols-2 gap-4">
                <label className="block"><span className="text-sm font-medium text-gray-700">Tipo de prenda *</span>
                  <select value={garmentTypeId} onChange={(e) => onGarmentTypeChange(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                    <option value="">— Selecciona —</option>{garmentTypes.map((g) => <option key={g.id} value={g.id}>{g.code} · {g.name}</option>)}
                  </select>
                  {gt && <span className="text-xs text-gray-400">Composición: {compositionLabel[gt.composition]}</span>}
                </label>
                <label className="block"><span className="text-sm font-medium text-gray-700">Colección</span>
                  <select value={collectionId} onChange={(e) => setCollectionId(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                    <option value="">— Sin colección —</option>{collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="block"><span className="text-sm font-medium text-gray-700">Código</span>
                  <div className="mt-1 flex items-stretch">
                    <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-100 text-gray-500 font-mono text-sm">{gtPrefix || '—'}</span>
                    <input value={codeSuffix} onChange={(e) => setCodeSuffix(e.target.value)} className="w-full border border-gray-300 rounded-r-lg px-3 py-2 font-mono" placeholder="0001" />
                  </div>
                  <span className="text-xs text-gray-400">El prefijo del tipo de prenda no se edita.</span>
                </label>
                <label className="block"><span className="text-sm font-medium text-gray-700">Estado</span>
                  <select value={isActive ? '1' : '0'} onChange={(e) => setIsActive(e.target.value === '1')} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                    <option value="1">Activa</option><option value="0">Inactiva</option>
                  </select>
                </label>
                <label className="block sm:col-span-2"><span className="text-sm font-medium text-gray-700">Nombre *</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
                <label className="block sm:col-span-2"><span className="text-sm font-medium text-gray-700">Descripción</span>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
              </div>
            </div>

            {/* Colores + tallas dentro del panel de producto */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-2">Colores</p>
              {colors.length === 0 ? <span className="text-sm text-gray-400">Sin colores en catálogo.</span> : (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Primarios (muestra)</p>
                    <MultiSelect placeholder="Buscar colores…" value={primaryIds} onChange={(ids) => setColorsByType('PRIMARY', ids)}
                      options={colors.filter((c) => !secondaryIds.includes(c.id)).map((c) => ({ id: c.id, label: c.name, hex: c.hexCode }))} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Secundarios</p>
                    <MultiSelect placeholder="Buscar colores…" value={secondaryIds} onChange={(ids) => setColorsByType('SECONDARY', ids)}
                      options={colors.filter((c) => !primaryIds.includes(c.id)).map((c) => ({ id: c.id, label: c.name, hex: c.hexCode }))} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Componentes */}
          <Section icon={<Boxes className="w-5 h-5" />} title="Componentes" subtitle="Piezas de la prenda de esta referencia (ej. Superior · Sweater, Inferior · Pantalón)" defaultOpen={gt?.composition === 'SET'}
            right={<span onClick={(e) => { e.stopPropagation(); addComponent(); }} className="inline-flex items-center gap-1 text-sm text-orange-700 font-medium cursor-pointer"><Plus className="w-4 h-4" /> Agregar</span>}>
            {components.length === 0 ? <div className="text-sm text-gray-400 py-2">Sin componentes.</div> : (
              <div className="space-y-2">
                {components.map((c, i) => (
                  <div key={c._key} className="flex items-center gap-2">
                    <select value={c.position} onChange={(e) => setComponents(components.map((x, idx) => idx === i ? { ...x, position: e.target.value as MfgComponentPosition } : x))} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                      <option value="SUPERIOR">Superior</option><option value="INFERIOR">Inferior</option>
                    </select>
                    <input value={c.description} onChange={(e) => setComponents(components.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} placeholder="Nombre de la pieza (ej. Sweater, Pantalón)" className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                    <button type="button" onClick={() => setComponents(components.filter((_, idx) => idx !== i))} className="p-2 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Ficha técnica / insumos — formulario de alta arriba + tabla abajo */}
          <Section icon={<Layers className="w-5 h-5" />} title="Ficha técnica (insumos)" subtitle="Agrega insumos: consumo inicial + incremento → consumo final; el precio se toma de los lotes (promedio)">
            {(() => {
              const dBatch = draft.inputId !== '' ? batchCache[Number(draft.inputId)] : undefined;
              const dLots = dBatch?.batches ?? [];
              return (
                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-12 sm:col-span-4"><span className="text-xs text-gray-500">Insumo *</span>
                      <select value={draft.inputId} onChange={(e) => onSelectDraftInput(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                        <option value="">— Selecciona —</option>
                        {inputsByType.map(([typeName, list]) => (
                          <optgroup key={typeName} label={typeName}>{list.map((inp) => <option key={inp.id} value={inp.id}>{inp.code} · {inp.name}</option>)}</optgroup>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-6 sm:col-span-4"><span className="text-xs text-gray-500">Componente</span>
                      <select value={draft.componentKey} onChange={(e) => patchDraft({ componentKey: e.target.value === '' ? '' : Number(e.target.value) })} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                        <option value="">—</option>{components.map((c) => <option key={c._key} value={c._key}>{c.position === 'SUPERIOR' ? 'Sup' : 'Inf'}{c.description ? ` · ${c.description}` : ''}</option>)}
                      </select>
                    </div>
                    <div className="col-span-6 sm:col-span-4"><span className="text-xs text-gray-500">Color</span>
                      <select value={draft.colorId} onChange={(e) => patchDraft({ colorId: e.target.value === '' ? '' : Number(e.target.value) })} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                        <option value="">Todos</option>{colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 items-end mt-2">
                    <div className="col-span-4 sm:col-span-2"><span className="text-xs text-gray-500">C. inicial</span><input type="number" step="0.0001" min="0" value={draft.consumptionInitial} onChange={(e) => patchDraft({ consumptionInitial: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" /></div>
                    <div className="col-span-4 sm:col-span-1"><span className="text-xs text-gray-500">Inc. %</span><input type="number" step="0.01" min="0" value={draft.increment} onChange={(e) => patchDraft({ increment: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" /></div>
                    <div className="col-span-4 sm:col-span-2"><span className="text-xs text-gray-500">C. final</span><input type="number" step="0.0001" min="0" value={draft.consumption} onChange={(e) => patchDraft({ consumption: e.target.value })} className="mt-1 w-full border border-orange-200 bg-orange-50/40 rounded-lg px-2 py-1.5 text-sm" /></div>
                    <div className="col-span-7 sm:col-span-3"><span className="text-xs text-gray-500">Precio {dLots.length > 0 ? `· ${dLots.length} lote${dLots.length > 1 ? 's' : ''}` : ''}</span>
                      {dLots.length > 0 ? (
                        <select onChange={(e) => { const v = e.target.value; if (v === 'avg') patchDraft({ unitValue: String(dBatch!.average) }); else { const b = dLots.find((x) => String(x.id) === v); if (b) patchDraft({ unitValue: String(b.unitCost), colorId: b.colorId ?? draft.colorId }); } }} value="" className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                          <option value="avg">Promedio · {money(dBatch!.average)}</option>
                          {dLots.map((b) => <option key={b.id} value={b.id}>{b.color?.name ? `${b.color.name} · ` : ''}{b.purchasedAt ?? 's/f'} · {money(Number(b.unitCost))}</option>)}
                        </select>
                      ) : <p className="mt-1 text-[11px] text-gray-400 py-1.5">Sin lotes; ingresa el valor.</p>}
                    </div>
                    <div className="col-span-5 sm:col-span-2"><span className="text-xs text-gray-500">Valor unit.</span><input type="number" step="0.01" min="0" value={draft.unitValue} onChange={(e) => patchDraft({ unitValue: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" /></div>
                    <div className="col-span-12 sm:col-span-2"><button type="button" onClick={addDraft} className="w-full inline-flex items-center justify-center gap-1 bg-slate-700 hover:bg-slate-800 text-white px-3 py-2 rounded-lg text-sm"><Plus className="w-4 h-4" /> Agregar</button></div>
                  </div>
                </div>
              );
            })()}

            {materials.length === 0 ? <div className="text-sm text-gray-400 py-2 text-center border border-dashed border-gray-200 rounded-lg">Aún no hay insumos. Agrega arriba.</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Insumo</th>
                      <th className="px-3 py-2 font-medium">Comp.</th>
                      <th className="px-3 py-2 font-medium">Color</th>
                      <th className="px-3 py-2 font-medium text-right">C.ini</th>
                      <th className="px-3 py-2 font-medium text-right">Inc.%</th>
                      <th className="px-3 py-2 font-medium text-right">C.final</th>
                      <th className="px-3 py-2 font-medium text-right">V.unit</th>
                      <th className="px-3 py-2 font-medium text-right">Total</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {materialTableGroups.map((grp) => {
                      const pct = basePrice > 0 ? (grp.subtotal / basePrice) * 100 : 0;
                      return (
                        <Fragment key={grp.name}>
                          <tr className="bg-slate-50 border-l-2 border-orange-400">
                            <td colSpan={2} className="px-3 py-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                              {grp.name}
                              {grp.classification === 'SERVICIO' && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-medium normal-case">Servicio</span>}
                              <span className="ml-1.5 text-gray-400 font-normal normal-case">· {grp.rows.length} ítem{grp.rows.length > 1 ? 's' : ''}</span>
                            </td>
                            <td colSpan={5} className="px-3 py-1.5 text-right text-[11px] text-gray-400">{pct > 0 ? `${pct.toFixed(1)}% del precio` : ''}</td>
                            <td className="px-3 py-1.5 text-right text-xs font-semibold text-gray-700">{money(grp.subtotal)}</td>
                            <td />
                          </tr>
                          {grp.rows.map(({ m, i }) => renderMaterialRow(m, i))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={7} className="px-3 py-2 text-right font-medium text-gray-700">Costo insumos</td>
                      <td className="px-3 py-2 text-right font-bold text-gray-900">{money(costVariable)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>

          {/* Costos y precios */}
          <Section icon={<Coins className="w-5 h-5" />} title="Costos y precios" subtitle="Costo fijo, factor y grupos de precio por tallas">
            {/* Costo Fijo · % Costo Fijo · Factor */}
            <div className="grid sm:grid-cols-3 gap-3 mb-3">
              <label className="block"><span className="text-sm font-medium text-gray-700">Costo Fijo</span><input type="number" step="0.01" min="0" value={fixedCost} onChange={(e) => setFixedCost(e.target.value)} placeholder="0.00" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" /><span className="text-[11px] text-gray-400">Sugerido por el tipo de prenda.</span></label>
              <label className="block"><span className="text-sm font-medium text-gray-700">% Costo Fijo</span><input type="number" value={fixedPct.toFixed(2)} readOnly className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500" /><span className="text-[11px] text-gray-400">Costo fijo ÷ costo insumos.</span></label>
              <label className="block"><span className="text-sm font-medium text-gray-700">Factor</span><input type="number" step="0.0001" min="0" value={factor} onChange={(e) => setFactor(e.target.value)} placeholder="1.00" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" /><span className="text-[11px] text-gray-400">Sugerido por el tipo de prenda.</span></label>
            </div>
            {/* Info: Costo Fijo · Factor · Costo Unitario · Precio de Venta */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
              <div className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-[11px] text-gray-500">Costo Fijo</p>
                <p><span className="font-semibold text-orange-600">{fixedPct.toFixed(2)}%</span><span className="text-gray-300 mx-1">|</span><span className="text-gray-500 text-sm">{money(Number(fixedCost) || 0)}</span></p>
              </div>
              <div className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-[11px] text-gray-500">Factor (x{Number(factor) || 1})</p>
                <p><span className="font-semibold text-green-600">{profitPct.toFixed(2)}%</span><span className="text-gray-300 mx-1">|</span><span className="text-gray-500 text-sm">+{money(profit)}</span></p>
              </div>
              <div className="border border-blue-200 bg-blue-50 rounded-lg px-3 py-2">
                <p className="text-[11px] text-blue-600">Costo Unitario</p>
                <p className="text-lg font-bold text-blue-700">{money(costUnit)}</p>
              </div>
              <div className="border border-green-200 bg-green-50 rounded-lg px-3 py-2">
                <p className="text-[11px] text-green-600">Precio de Venta</p>
                <p className="text-lg font-bold text-green-700">{money(basePrice)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Grupos de tallas (listas de precio)</p>
              <button type="button" onClick={addGroup} className="inline-flex items-center gap-1 text-sm text-orange-700 font-medium"><Plus className="w-4 h-4" /> Agregar grupo</button>
            </div>
            {groups.length === 0 ? <div className="text-sm text-gray-400 py-2 text-center border border-dashed border-gray-200 rounded-lg">Sin grupos de precio.</div> : (
              <div className="space-y-4">
                {groups.map((g, gi) => {
                  const set = (patch: Partial<GroupRow>) => setGroups(groups.map((x, idx) => idx === gi ? { ...x, ...patch } : x));
                  const accent = g.market === 'EXPORT' ? 'blue' : 'orange';
                  const marketSizes = sizesForMarket(g.market);
                  return (
                    <div key={gi} className={`border rounded-xl overflow-hidden ${g.market === 'EXPORT' ? 'border-blue-200' : 'border-orange-200'}`}>
                      {/* Header: nombre · mercado · mayorista · eliminar */}
                      <div className={`flex items-center gap-2 flex-wrap px-3 py-2 ${g.market === 'EXPORT' ? 'bg-blue-50' : 'bg-orange-50'}`}>
                        <input value={g.name} onChange={(e) => set({ name: e.target.value })} placeholder="Nombre del grupo" className="flex-1 min-w-[8rem] border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white" />
                        <select value={g.market} onChange={(e) => { const m = e.target.value as MfgMarket; set({ market: m, sizeIds: sizesForMarket(m).map((s) => s.id) }); }} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"><option value="NATIONAL">Nacional</option><option value="EXPORT">Exportación</option></select>
                        <label className="inline-flex items-center gap-1.5 text-sm text-gray-700"><input type="checkbox" checked={g.isWholesale} onChange={(e) => set({ isWholesale: e.target.checked })} /> Mayorista</label>
                        <button type="button" onClick={() => setGroups(groups.filter((_, idx) => idx !== gi))} className="ml-auto inline-flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg"><Trash2 className="w-3.5 h-3.5" /> Eliminar</button>
                      </div>

                      <div className="p-3 grid lg:grid-cols-3 gap-3">
                        {/* Costos + precio final */}
                        <div className="lg:col-span-2">
                          <div className="grid grid-cols-3 gap-2 items-end">
                            <label className="block"><span className="text-xs text-gray-500">Costo fijo adic.</span>
                              <div className="mt-1 flex"><span className="inline-flex items-center px-2 rounded-l-lg border border-r-0 border-gray-300 bg-gray-100 text-gray-500 text-sm">$</span><input type="number" step="0.01" min="0" value={g.fixedCostExtra} onChange={(e) => set({ fixedCostExtra: e.target.value })} className="w-full border border-gray-300 rounded-r-lg px-2 py-1.5 text-sm" /></div>
                            </label>
                            <label className="block"><span className="text-xs text-gray-500">Factor</span>
                              <div className="mt-1 flex"><span className="inline-flex items-center px-2 rounded-l-lg border border-r-0 border-gray-300 bg-gray-100 text-gray-500 text-sm">x</span><input type="number" step="0.0001" min="0" value={g.factor} onChange={(e) => set({ factor: e.target.value })} className="w-full border border-gray-300 px-2 py-1.5 text-sm" /><span className="inline-flex items-center px-1.5 rounded-r-lg border border-l-0 border-gray-300 bg-sky-500 text-white text-[11px] min-w-[46px] justify-center">{groupProfitPct(g).toFixed(1)}%</span></div>
                            </label>
                            <label className="block"><span className="text-xs text-gray-500">Precio Lista</span>
                              <input type="number" step="0.01" min="0" disabled={g.auto} value={g.auto ? Math.round(groupPrice(g)) : g.listPrice} onChange={(e) => set({ listPrice: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-500" />
                              <label className="inline-flex items-center gap-1 mt-1 text-[11px] text-gray-500"><input type="checkbox" checked={g.auto} onChange={(e) => set({ auto: e.target.checked })} /> Auto: <b className={g.market === 'EXPORT' ? 'text-blue-600' : 'text-orange-600'}>{money(Math.round(groupPrice(g)))}</b></label>
                            </label>
                          </div>
                          {/* Precio Final destacado */}
                          <div className={`mt-2 rounded-lg py-2 text-center border ${g.market === 'EXPORT' ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                            <p className="text-[11px] text-gray-500">Precio Final</p>
                            <p className={`text-lg font-bold ${g.market === 'EXPORT' ? 'text-blue-700' : 'text-orange-700'}`}>{money(g.auto || !g.listPrice ? Math.round(groupPrice(g)) : Number(g.listPrice))}</p>
                          </div>
                          {/* Recargo por color */}
                          {refColors.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 mb-1">Recargo por color (se suma en la venta)</p>
                              <div className="flex flex-wrap gap-2">
                                {refColors.map((c) => (
                                  <div key={c.id} className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1">
                                    <span className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: c.hexCode }} />
                                    <span className="text-xs text-gray-600">{c.name}</span>
                                    <input type="number" step="0.01" min="0" value={g.surcharges[c.id] ?? ''} onChange={(e) => set({ surcharges: { ...g.surcharges, [c.id]: e.target.value } })} placeholder="+$0" className="w-16 border border-gray-300 rounded px-1.5 py-0.5 text-xs" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {/* Tallas del grupo */}
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Tallas del grupo</p>
                          {marketSizes.length === 0 ? <span className="text-xs text-gray-400">El tipo de prenda no tiene tallas para {g.market === 'EXPORT' ? 'Exportación' : 'Nacional'}.</span> : (
                            <div className="flex flex-wrap gap-1.5">
                              {marketSizes.map((s) => (
                                <button key={s.id} type="button" onClick={() => set({ sizeIds: g.sizeIds.includes(s.id) ? g.sizeIds.filter((x) => x !== s.id) : [...g.sizeIds, s.id] })} className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${g.sizeIds.includes(s.id) ? (accent === 'blue' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-orange-500 bg-orange-50 text-orange-800') : 'border-gray-300 text-gray-500'}`}>{s.abbreviation}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
