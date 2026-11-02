import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Pencil, Save, ImageIcon, Package, Boxes, Layers, Coins, Shirt, Check, Calculator, TrendingUp, Tag } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import MultiSelect from '../../components/manufacturing/MultiSelect';
import { socialService } from '../../services/social.service';
import type {
  MfgGarmentType, MfgColor, MfgSize, MfgInput, MfgCollection,
  MfgColorType, MfgMarket, MfgComponentPosition, MfgReferenceInput, MfgInputBatch,
} from '../../types/manufacturing';
import {
  Page, PageHeader, Button, IconButton, Card, CardTitle, StatCard, Badge, Tabs, Alert, DescriptionList,
  Field, TextInput, TextArea, SelectInput, NumberInput, MoneyInput, AddonInput, Switch, Checkbox, ImageInput, FormGrid,
  TableCard, Table, THead, TBody, Th, Tr, Td, Spinner, EmptyState,
} from '../../components/ui';
import { MarketBadge } from '../../components/manufacturing/mfgUi';

const money = (n: number) => '$' + n.toLocaleString('es-CO', { maximumFractionDigits: 2 });
// Indicadores en pesos: sin decimales.
const money0 = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

interface ComponentRow { _key: number; position: MfgComponentPosition; description: string; }
interface MaterialRow { inputId: number | ''; colorId: number | ''; componentKey: number | ''; consumptionInitial: string; increment: string; consumption: string; unitValue: string; unitOfMeasure: string; notes: string; }
// factorLinked: el check "Usar" del factor sugerido es explícito por grupo (no se deduce de la igualdad),
// así se puede desmarcar aunque el factor general sea igual al sugerido.
interface GroupRow { name: string; market: MfgMarket; fixedCostExtra: string; factor: string; factorLinked: boolean; listPrice: string; auto: boolean; isWholesale: boolean; sizeIds: number[]; surcharges: Record<number, string>; }

type TabKey = 'summary' | 'info' | 'materials' | 'prices';

export default function ReferenceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = id !== undefined && id !== 'new';
  const refId = isEdit ? Number(id) : 0;
  const keyRef = useRef(1);

  const [tab, setTab] = useState<TabKey>(isEdit ? 'summary' : 'info');

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
  const [exchangeRate, setExchangeRate] = useState(0); // COP por USD (para exportación)
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
        try { const er = await manufacturingService.getActiveExchangeRate(); if (er) setExchangeRate(Number(er.rate)); } catch { /* noop */ }

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
          const gtL = gts.find((x) => x.id === r.garmentTypeId);
          const sugFactor = (m: MfgMarket) => Number((m === 'EXPORT' ? gtL?.factorExport : gtL?.factor) ?? r.factor ?? 1);
          setGroups(r.sizeGroups.map((g) => ({
            name: g.name, market: g.market, fixedCostExtra: String(g.fixedCostExtra ?? 0), factor: String(g.factor ?? 1),
            factorLinked: Number(g.factor ?? 1) === sugFactor(g.market),
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
  // ImageInput entrega un data URL (archivo) o un enlace: el archivo se sube igual que antes y se guarda su URL.
  const onImage = async (v: string) => {
    if (!v) { setImagePath(null); return; }
    if (!v.startsWith('data:')) { setImagePath(v); return; }
    try {
      const blob = await (await fetch(v)).blob();
      const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      await uploadImg(new File([blob], `referencia.${ext}`, { type: blob.type }));
    } catch { toast.error('No se pudo leer la imagen'); }
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
  // Precio del grupo: pesos para nacional (entero); dividido por la tasa (USD, 2 dec) para exportación.
  const groupPrice = (g: GroupRow) => {
    if (!(g.auto || !g.listPrice)) return Number(g.listPrice);
    const pesos = (costUnit + (Number(g.fixedCostExtra) || 0)) * (Number(g.factor) || 1);
    // Sin tasa activa no hay precio en USD (nunca mostrar/guardar pesos como dólares).
    if (g.market === 'EXPORT') return exchangeRate > 0 ? Math.round((pesos / exchangeRate) * 100) / 100 : 0;
    return Math.round(pesos);
  };
  const groupProfitPct = (g: GroupRow) => { const f = Number(g.factor) || 0; return f > 0 ? (1 - 1 / f) * 100 : 0; };
  // Formato de moneda por grupo (US$ con 2 decimales para exportación).
  const groupMoney = (g: GroupRow, n: number) => (g.market === 'EXPORT' ? 'US$' : '$') + n.toLocaleString('es-CO', g.market === 'EXPORT' ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 });
  // El precio depende de la tasa solo si es automático o no tiene precio de lista (los USD manuales no).
  const needsRate = (g: GroupRow) => g.market === 'EXPORT' && (g.auto || !g.listPrice);

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
  // Factor sugerido por el tipo de prenda según el mercado.
  const gtFactorFor = (market: MfgMarket) => {
    const g = garmentTypes.find((x) => x.id === garmentTypeId);
    const f = market === 'EXPORT' ? g?.factorExport : g?.factor;
    return f !== undefined && f !== null ? String(f) : factor;
  };
  const addGroup = () => {
    const g = garmentTypes.find((x) => x.id === garmentTypeId);
    const natIds = (g?.sizes ?? []).filter((s) => (s.pivot?.market ?? 'NATIONAL') === 'NATIONAL').map((s) => s.id);
    setGroups([...groups, { name: '', market: 'NATIONAL', fixedCostExtra: '0', factor: gtFactorFor('NATIONAL'), factorLinked: true, listPrice: '', auto: true, isWholesale: false, sizeIds: natIds, surcharges: {} }]);
  };

  const save = async () => {
    if (garmentTypeId === '') { toast.error('Selecciona el tipo de prenda'); setTab('info'); return; }
    if (!name.trim()) { toast.error('El nombre es obligatorio'); setTab('info'); return; }
    if (materials.some((m) => m.inputId === '')) { toast.error('Cada material debe tener un insumo'); setTab('materials'); return; }
    if (!(exchangeRate > 0) && groups.some(needsRate)) {
      toast.error('No hay tasa de cambio activa: regístrala en Catálogos para calcular los precios de exportación'); setTab('prices'); return;
    }

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
        factor: Number(g.factor) || 1, listPrice: g.auto ? groupPrice(g) : (Number(g.listPrice) || 0), isWholesale: g.isWholesale, sizeIds: g.sizeIds,
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

  if (loading) return <Page><Spinner label="Cargando…" /></Page>;
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
  const cellInput = 'h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500';
  const renderMaterialRow = (m: MaterialRow, i: number) => {
    if (editIdx === i) {
      const eBatch = m.inputId !== '' ? batchCache[Number(m.inputId)] : undefined;
      const eLots = eBatch?.batches ?? [];
      return (
        <tr key={i} className="bg-app-50/40">
          <td className="px-2 py-2">
            <select value={m.inputId} onChange={(e) => onSelectInputAt(i, e.target.value === '' ? '' : Number(e.target.value))} className={`${cellInput} w-full min-w-[10rem]`} aria-label="Insumo">
              <option value="">—</option>
              {inputsByType.map(([tn, list]) => <optgroup key={tn} label={tn}>{list.map((inp) => <option key={inp.id} value={inp.id}>{inp.code} · {inp.name}</option>)}</optgroup>)}
            </select>
          </td>
          <td className="px-2 py-2">
            <select value={m.componentKey} onChange={(e) => patchMaterialAt(i, { componentKey: e.target.value === '' ? '' : Number(e.target.value) })} className={`${cellInput} w-full`} aria-label="Componente">
              <option value="">—</option>{components.map((c) => <option key={c._key} value={c._key}>{c.position === 'SUPERIOR' ? 'Sup' : 'Inf'}{c.description ? ` · ${c.description}` : ''}</option>)}
            </select>
          </td>
          <td className="px-2 py-2">
            <select value={m.colorId} onChange={(e) => patchMaterialAt(i, { colorId: e.target.value === '' ? '' : Number(e.target.value) })} className={`${cellInput} w-full`} aria-label="Color">
              <option value="">Todos</option>{colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </td>
          <td className="px-2 py-2"><input type="number" step="0.0001" min="0" value={m.consumptionInitial} onChange={(e) => patchMaterialAt(i, { consumptionInitial: e.target.value })} className={`${cellInput} w-20 text-right`} aria-label="Consumo inicial" /></td>
          <td className="px-2 py-2"><input type="number" step="0.01" min="0" value={m.increment} onChange={(e) => patchMaterialAt(i, { increment: e.target.value })} className={`${cellInput} w-16 text-right`} aria-label="Incremento %" /></td>
          <td className="px-2 py-2"><input type="number" step="0.0001" min="0" value={m.consumption} onChange={(e) => patchMaterialAt(i, { consumption: e.target.value })} className={`${cellInput} w-20 text-right border-app-300`} aria-label="Consumo final" /></td>
          <td className="px-2 py-2">
            <input type="number" step="0.01" min="0" value={m.unitValue} onChange={(e) => patchMaterialAt(i, { unitValue: e.target.value })} className={`${cellInput} w-24 text-right`} aria-label="Valor unitario" />
            {eLots.length > 0 && (
              <select onChange={(e) => { const v = e.target.value; if (v === 'avg') patchMaterialAt(i, { unitValue: String(eBatch!.average) }); else { const b = eLots.find((x) => String(x.id) === v); if (b) patchMaterialAt(i, { unitValue: String(b.unitCost), colorId: b.colorId ?? m.colorId }); } }} value="" className={`${cellInput} mt-1 w-24 h-7 text-[11px]`} aria-label="Tomar precio de un lote">
                <option value="">Lote…</option>
                <option value="avg">Prom · {money(eBatch!.average)}</option>
                {eLots.map((b) => <option key={b.id} value={b.id}>{b.color?.name ? `${b.color.name} · ` : ''}{money(Number(b.unitCost))}</option>)}
              </select>
            )}
          </td>
          <td className="px-2 py-2 text-right font-medium text-gray-900 tabular-nums">{money((Number(m.consumption) || 0) * (Number(m.unitValue) || 0))}</td>
          <td className="px-2 py-2 text-right"><Button size="sm" variant="success" icon={<Check className="w-4 h-4" />} onClick={() => setEditIdx(null)}>Listo</Button></td>
        </tr>
      );
    }
    const inp = inputs.find((x) => x.id === m.inputId);
    const comp = components.find((c) => c._key === m.componentKey);
    const col2 = colors.find((c) => c.id === m.colorId);
    return (
      <Tr key={i}>
        <Td className="text-gray-900">{inp ? <><span className="font-mono text-xs text-gray-500 mr-1">{inp.code}</span>{inp.name}</> : '—'}</Td>
        <Td>{comp ? `${comp.position === 'SUPERIOR' ? 'Sup' : 'Inf'}${comp.description ? ' · ' + comp.description : ''}` : '—'}</Td>
        <Td>{col2 ? <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: col2.hexCode }} />{col2.name}</span> : 'Todos'}</Td>
        <Td align="right" className="tabular-nums">{m.consumptionInitial || '—'}</Td>
        <Td align="right" className="tabular-nums">{m.increment && Number(m.increment) > 0 ? `${m.increment}%` : '—'}</Td>
        <Td align="right" className="font-medium text-gray-900 tabular-nums whitespace-nowrap">{m.consumption} {m.unitOfMeasure}</Td>
        <Td align="right" className="tabular-nums">{money(Number(m.unitValue) || 0)}</Td>
        <Td align="right" className="font-medium text-gray-900 tabular-nums">{money((Number(m.consumption) || 0) * (Number(m.unitValue) || 0))}</Td>
        <Td align="right">
          <div className="flex items-center justify-end gap-0.5">
            <IconButton title="Editar insumo" tone="app" onClick={() => startEdit(i)}><Pencil className="w-4 h-4" /></IconButton>
            <IconButton title="Quitar insumo" tone="danger" onClick={() => removeMaterial(i)}><Trash2 className="w-4 h-4" /></IconButton>
          </div>
        </Td>
      </Tr>
    );
  };

  const sizeChips = (list: { id: number; abbreviation: string }[], market: MfgMarket) => (
    list.length
      ? <div className="flex flex-wrap gap-1">{list.map((s) => <Badge key={s.id} tone={market === 'EXPORT' ? 'blue' : 'gray'}>{s.abbreviation}</Badge>)}</div>
      : <span className="text-xs text-gray-400">—</span>
  );

  const dBatch = draft.inputId !== '' ? batchCache[Number(draft.inputId)] : undefined;
  const dLots = dBatch?.batches ?? [];

  return (
    <Page>
      <PageHeader
        icon={Shirt}
        backTo="/manufacturing/references"
        title={isEdit ? (name || 'Referencia') : 'Nueva referencia'}
        subtitle={fullCode ? <span className="font-mono">{fullCode}</span> : 'Ficha técnica: producto, insumos y precios.'}
        actions={<Button icon={<Save className="w-4 h-4" />} isLoading={saving} onClick={save}>Guardar</Button>}
      />

      <Tabs<TabKey>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'summary', label: 'Resumen' },
          { value: 'info', label: 'Producto' },
          { value: 'materials', label: 'Ficha técnica', count: materials.length },
          { value: 'prices', label: 'Costos y precios', count: groups.length },
        ]}
      />

      {/* ======================= RESUMEN ======================= */}
      {tab === 'summary' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={Layers} label="Costo insumos" value={money0(costVariable)} hint={`${materials.length} insumo${materials.length !== 1 ? 's' : ''}`} />
            <StatCard icon={Calculator} tone="blue" label="Costo unidad" value={money0(costUnit)} hint={`Costo fijo ${money0(Number(fixedCost) || 0)}`} />
            <StatCard icon={Tag} tone="green" label="Precio base" value={money0(basePrice)} hint={`Factor x${Number(factor) || 1}`} />
            <StatCard icon={TrendingUp} tone={profit >= 0 ? 'green' : 'red'} label="Ganancia" value={`${profitPct.toFixed(1)}%`} hint={`${profit >= 0 ? '+' : ''}${money0(profit)} por unidad`} hintTone={profit >= 0 ? 'green' : 'red'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            <div className="lg:col-span-2 space-y-5">
              <Card>
                <div className="flex gap-5 flex-col sm:flex-row">
                  <div className="w-full sm:w-44 flex-shrink-0">
                    {imagePath ? <img src={imagePath} alt={name} className="w-full aspect-square object-cover rounded-xl border border-gray-200" /> : <div className="w-full aspect-square rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-gray-300"><ImageIcon className="w-10 h-10" /></div>}
                  </div>
                  <div className="flex-1 min-w-0 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-semibold text-gray-900">{name || '—'}</h2>
                        {gt && <Badge tone={gt.composition === 'SET' ? 'purple' : 'gray'}>{compositionLabel[gt.composition]}</Badge>}
                        <Badge tone={isActive ? 'green' : 'gray'}>{isActive ? 'Activa' : 'Inactiva'}</Badge>
                      </div>
                      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
                    </div>
                    <DescriptionList cols={2} items={[
                      { label: 'Código', value: fullCode ? <span className="font-mono">{fullCode}</span> : null },
                      { label: 'Tipo de prenda', value: gt?.name },
                      { label: 'Marca', value: gt?.brand?.name },
                      { label: 'Colección', value: col?.name },
                      {
                        label: 'Colores', full: true,
                        value: refColors.length === 0 ? null : (
                          <div className="flex flex-wrap gap-1.5">
                            {[...primary, ...secondary].map((c) => (
                              <span key={c.id} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${colorState[c.id] === 'PRIMARY' ? 'bg-app-50 text-app-700' : 'bg-gray-100 text-gray-600'}`}>
                                <span className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: c.hexCode }} />{c.name}
                              </span>
                            ))}
                          </div>
                        ),
                      },
                    ]} />
                  </div>
                </div>
              </Card>

              <Card>
                <CardTitle icon={Coins}>Precios por grupo de tallas</CardTitle>
                {groups.length === 0 ? <p className="text-sm text-gray-400">Sin grupos de precio.</p> : (
                  <div className="divide-y divide-gray-100 -my-2">
                    {groups.map((g, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 flex-wrap text-sm font-medium text-gray-900">{g.name || 'Grupo'}<MarketBadge market={g.market} />{g.isWholesale && <Badge>Mayorista</Badge>}</p>
                          <div className="flex flex-wrap gap-1 mt-1">{g.sizeIds.map((sid) => <span key={sid} className="text-[11px] bg-gray-100 text-gray-600 rounded px-1.5">{sizeById(sid)?.abbreviation}</span>)}</div>
                        </div>
                        <span className="font-semibold text-gray-900 tabular-nums whitespace-nowrap">{groupMoney(g, groupPrice(g))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <Card>
              <CardTitle icon={Layers} actions={<span className="text-sm font-medium text-gray-900 tabular-nums">{money(costVariable)}</span>}>Insumos</CardTitle>
              {materials.length === 0 ? <p className="text-sm text-gray-400">Sin materiales.</p> : (
                <div className="space-y-4">
                  {insumoGroups.map((grp) => (
                    <div key={grp.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {grp.name}
                          {grp.classification === 'SERVICIO' && <Badge tone="purple" className="normal-case">Servicio</Badge>}
                        </span>
                        <span className="text-xs font-medium text-gray-700 tabular-nums">{money(grp.subtotal)}</span>
                      </div>
                      <ul className="space-y-1.5">
                        {grp.rows.map((r) => (
                          <li key={r.key} className="flex items-center justify-between gap-2 text-sm">
                            <div className="min-w-0">
                              <p className="text-gray-900 truncate">{r.name}{r.scope && <span className="ml-1.5 text-[10px] text-gray-400">({r.scope === 'EXTERNAL' ? 'ext.' : 'int.'})</span>}</p>
                              <p className="text-xs text-gray-400">{r.detail}</p>
                            </div>
                            <span className="text-gray-700 tabular-nums">{money(r.subtotal)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {/* ======================= PRODUCTO ======================= */}
      {tab === 'info' && (
        <>
          <Card>
            <CardTitle icon={Package}>Información del producto</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field label="Imagen" hint={uploading ? 'Subiendo imagen…' : undefined}>
                <ImageInput value={imagePath} onChange={onImage} disabled={uploading} />
              </Field>
              <div className="md:col-span-2">
                <FormGrid>
                  <Field label="Tipo de prenda" required hint={gt ? `Composición: ${compositionLabel[gt.composition]}` : undefined}>
                    <SelectInput value={garmentTypeId} onChange={(e) => onGarmentTypeChange(e.target.value === '' ? '' : Number(e.target.value))}>
                      <option value="">— Selecciona —</option>{garmentTypes.map((g) => <option key={g.id} value={g.id}>{g.code} · {g.name}</option>)}
                    </SelectInput>
                  </Field>
                  <Field label="Colección">
                    <SelectInput value={collectionId} onChange={(e) => setCollectionId(e.target.value === '' ? '' : Number(e.target.value))}>
                      <option value="">— Sin colección —</option>{collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </SelectInput>
                  </Field>
                  <Field label="Código" hint="El prefijo del tipo de prenda no se edita.">
                    <AddonInput prefix={gtPrefix || "—"} value={codeSuffix} onChange={(e) => setCodeSuffix(e.target.value)} className="font-mono" placeholder="0001" />
                  </Field>
                  <Field label="Estado">
                    <div className="h-10 flex items-center"><Switch checked={isActive} onChange={setIsActive} label={isActive ? 'Activa' : 'Inactiva'} /></div>
                  </Field>
                  <Field label="Nombre" required className="md:col-span-2"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
                  <Field label="Descripción" className="md:col-span-2"><TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
                </FormGrid>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            <Card className="lg:col-span-2">
              <CardTitle>Colores</CardTitle>
              {colors.length === 0 ? <p className="text-sm text-gray-400">Sin colores en el catálogo.</p> : (
                <FormGrid>
                  <Field label="Primarios (muestra)">
                    <MultiSelect placeholder="Buscar colores…" value={primaryIds} onChange={(ids) => setColorsByType('PRIMARY', ids)}
                      options={colors.filter((c) => !secondaryIds.includes(c.id)).map((c) => ({ id: c.id, label: c.name, hex: c.hexCode }))} />
                  </Field>
                  <Field label="Secundarios">
                    <MultiSelect placeholder="Buscar colores…" value={secondaryIds} onChange={(ids) => setColorsByType('SECONDARY', ids)}
                      options={colors.filter((c) => !primaryIds.includes(c.id)).map((c) => ({ id: c.id, label: c.name, hex: c.hexCode }))} />
                  </Field>
                </FormGrid>
              )}
            </Card>

            <Card>
              <CardTitle>Tallas</CardTitle>
              {!gt ? <p className="text-sm text-gray-400">Selecciona un tipo de prenda.</p> : (
                <div className="space-y-3">
                  <div className="space-y-1.5"><MarketBadge market="NATIONAL" />{sizeChips(natSizes, 'NATIONAL')}</div>
                  <div className="space-y-1.5"><MarketBadge market="EXPORT" />{sizeChips(expSizes, 'EXPORT')}</div>
                  <p className="text-xs text-gray-500">Se definen en el tipo de prenda.</p>
                </div>
              )}
            </Card>
          </div>

          <Card>
            <CardTitle icon={Boxes} actions={<Button size="sm" variant="ghost" icon={<Plus className="w-4 h-4" />} onClick={addComponent}>Agregar</Button>}>Componentes</CardTitle>
            <p className="text-xs text-gray-500 -mt-2 mb-3">Piezas de la prenda (ej. Superior · Sweater, Inferior · Pantalón).</p>
            {components.length === 0 ? <p className="text-sm text-gray-400">Sin componentes.</p> : (
              <div className="space-y-2">
                {components.map((c, i) => (
                  <div key={c._key} className="flex items-center gap-2">
                    <div className="w-36 flex-shrink-0"><SelectInput value={c.position} onChange={(e) => setComponents(components.map((x, idx) => idx === i ? { ...x, position: e.target.value as MfgComponentPosition } : x))} aria-label="Posición">
                      <option value="SUPERIOR">Superior</option><option value="INFERIOR">Inferior</option>
                    </SelectInput></div>
                    <TextInput value={c.description} onChange={(e) => setComponents(components.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} placeholder="Nombre de la pieza (ej. Sweater, Pantalón)" aria-label="Nombre de la pieza" />
                    <IconButton title="Quitar componente" tone="danger" onClick={() => setComponents(components.filter((_, idx) => idx !== i))}><Trash2 className="w-4 h-4" /></IconButton>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* ======================= FICHA TÉCNICA ======================= */}
      {tab === 'materials' && (
        <>
          <Card>
            <CardTitle icon={Plus}>Agregar insumo</CardTitle>
            <p className="text-xs text-gray-500 -mt-2 mb-4">Consumo inicial + incremento → consumo final. El precio se toma de los lotes del insumo (promedio).</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Insumo" required>
                <SelectInput value={draft.inputId} onChange={(e) => onSelectDraftInput(e.target.value === '' ? '' : Number(e.target.value))}>
                  <option value="">— Selecciona —</option>
                  {inputsByType.map(([typeName, list]) => (
                    <optgroup key={typeName} label={typeName}>{list.map((inp) => <option key={inp.id} value={inp.id}>{inp.code} · {inp.name}</option>)}</optgroup>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Componente">
                <SelectInput value={draft.componentKey} onChange={(e) => patchDraft({ componentKey: e.target.value === '' ? '' : Number(e.target.value) })}>
                  <option value="">—</option>{components.map((c) => <option key={c._key} value={c._key}>{c.position === 'SUPERIOR' ? 'Sup' : 'Inf'}{c.description ? ` · ${c.description}` : ''}</option>)}
                </SelectInput>
              </Field>
              <Field label="Color">
                <SelectInput value={draft.colorId} onChange={(e) => patchDraft({ colorId: e.target.value === '' ? '' : Number(e.target.value) })}>
                  <option value="">Todos</option>{colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </SelectInput>
              </Field>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4 items-start">
              <Field label="Consumo inicial"><NumberInput step="0.0001" min="0" value={draft.consumptionInitial} onChange={(e) => patchDraft({ consumptionInitial: e.target.value })} /></Field>
              <Field label="Incremento"><NumberInput step="0.01" min="0" suffix="%" value={draft.increment} onChange={(e) => patchDraft({ increment: e.target.value })} /></Field>
              <Field label="Consumo final" required><NumberInput step="0.0001" min="0" suffix={draft.unitOfMeasure || undefined} value={draft.consumption} onChange={(e) => patchDraft({ consumption: e.target.value })} /></Field>
              <Field label={`Precio de lote${dLots.length > 0 ? ` (${dLots.length})` : ''}`} className="col-span-2 md:col-span-1">
                {dLots.length > 0 ? (
                  <SelectInput onChange={(e) => { const v = e.target.value; if (v === 'avg') patchDraft({ unitValue: String(dBatch!.average) }); else { const b = dLots.find((x) => String(x.id) === v); if (b) patchDraft({ unitValue: String(b.unitCost), colorId: b.colorId ?? draft.colorId }); } }} value="">
                    <option value="avg">Promedio · {money(dBatch!.average)}</option>
                    {dLots.map((b) => <option key={b.id} value={b.id}>{b.color?.name ? `${b.color.name} · ` : ''}{b.purchasedAt?.slice(0, 10) ?? 's/f'} · {money(Number(b.unitCost))}</option>)}
                  </SelectInput>
                ) : <p className="h-10 flex items-center text-xs text-gray-400">Sin lotes; ingresa el valor.</p>}
              </Field>
              <Field label="Valor unitario"><MoneyInput value={draft.unitValue} onChange={(e) => patchDraft({ unitValue: e.target.value })} /></Field>
              <div className="col-span-2 md:col-span-1 md:pt-6"><Button variant="outline" fullWidth icon={<Plus className="w-4 h-4" />} onClick={addDraft}>Agregar</Button></div>
            </div>
          </Card>

          {materials.length === 0 ? (
            <Card><EmptyState icon={Layers} title="Aún no hay insumos" description="Agrégalos con el formulario de arriba." /></Card>
          ) : (
            <TableCard>
              <Table>
                <THead>
                  <tr>
                    <Th>Insumo</Th><Th>Comp.</Th><Th>Color</Th><Th align="right">C. inicial</Th><Th align="right">Inc.</Th><Th align="right">C. final</Th><Th align="right">V. unit.</Th><Th align="right">Total</Th><Th align="right"><span className="sr-only">Acciones</span></Th>
                  </tr>
                </THead>
                <TBody>
                  {materialTableGroups.map((grp) => {
                    const pct = basePrice > 0 ? (grp.subtotal / basePrice) * 100 : 0;
                    return (
                      <Fragment key={grp.name}>
                        <tr className="bg-gray-50">
                          <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide border-l-2 border-app-500">
                            <span className="inline-flex items-center gap-1.5">
                              {grp.name}
                              {grp.classification === 'SERVICIO' && <Badge tone="purple" className="normal-case">Servicio</Badge>}
                              <span className="text-gray-400 font-normal normal-case">· {grp.rows.length} ítem{grp.rows.length > 1 ? 's' : ''}</span>
                            </span>
                          </td>
                          <td colSpan={5} className="px-4 py-2 text-right text-[11px] text-gray-400">{pct > 0 ? `${pct.toFixed(1)}% del precio` : ''}</td>
                          <td className="px-4 py-2 text-right text-xs font-semibold text-gray-900 tabular-nums">{money(grp.subtotal)}</td>
                          <td />
                        </tr>
                        {grp.rows.map(({ m, i }) => renderMaterialRow(m, i))}
                      </Fragment>
                    );
                  })}
                </TBody>
                <tfoot className="border-t border-gray-200 bg-gray-50">
                  <tr>
                    <td colSpan={7} className="px-4 py-3 text-right font-medium text-gray-700">Costo insumos</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 tabular-nums">{money(costVariable)}</td>
                    <td />
                  </tr>
                </tfoot>
              </Table>
            </TableCard>
          )}
        </>
      )}

      {/* ======================= COSTOS Y PRECIOS ======================= */}
      {tab === 'prices' && (
        <>
          <Card>
            <CardTitle icon={Calculator}>Costo base</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Costo fijo" hint="Sugerido por el tipo de prenda."><MoneyInput value={fixedCost} onChange={(e) => setFixedCost(e.target.value)} placeholder="0.00" /></Field>
              <Field label="% costo fijo" hint="Costo fijo ÷ costo insumos."><NumberInput value={fixedPct.toFixed(2)} readOnly disabled suffix="%" /></Field>
              <Field label="Factor" hint="Sugerido por el tipo de prenda."><NumberInput step="0.0001" min="0" value={factor} onChange={(e) => setFactor(e.target.value)} placeholder="1.00" suffix="x" /></Field>
            </div>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={Coins} tone="gray" label="Costo fijo" value={money0(Number(fixedCost) || 0)} hint={`${fixedPct.toFixed(2)}% de los insumos`} />
            <StatCard icon={TrendingUp} tone={profit >= 0 ? 'green' : 'red'} label={`Factor x${Number(factor) || 1}`} value={`${profitPct.toFixed(2)}%`} hint={`${profit >= 0 ? '+' : ''}${money0(profit)} de ganancia`} hintTone={profit >= 0 ? 'green' : 'red'} />
            <StatCard icon={Calculator} tone="blue" label="Costo unitario" value={money0(costUnit)} />
            <StatCard icon={Tag} tone="green" label="Precio de venta" value={money0(basePrice)} />
          </div>

          <Card>
            <CardTitle icon={Coins} actions={<Button size="sm" variant="outline" icon={<Plus className="w-4 h-4" />} onClick={addGroup}>Agregar grupo</Button>}>Grupos de tallas (listas de precio)</CardTitle>
            {groups.length === 0 ? <EmptyState icon={Coins} title="Sin grupos de precio" description="Crea un grupo por mercado y tallas para definir su precio de lista." /> : (
              <div className="divide-y divide-gray-200 border-y border-gray-200 -mx-4 md:-mx-5">
                {groups.map((g, gi) => {
                  const set = (patch: Partial<GroupRow>) => setGroups(groups.map((x, idx) => idx === gi ? { ...x, ...patch } : x));
                  const marketSizes = sizesForMarket(g.market);
                  const sugFactor = gtFactorFor(g.market);
                  const finalPrice = g.auto || !g.listPrice ? groupPrice(g) : Number(g.listPrice);
                  const noRate = needsRate(g) && !(exchangeRate > 0);
                  return (
                    <div key={gi} className="px-4 md:px-5 py-4 space-y-4">
                      {/* Nombre · mercado · mayorista · eliminar */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <MarketBadge market={g.market} />
                        <div className="flex-1 min-w-[10rem]"><TextInput value={g.name} onChange={(e) => set({ name: e.target.value })} placeholder="Nombre del grupo" aria-label="Nombre del grupo" /></div>
                        <div className="w-40"><SelectInput value={g.market} onChange={(e) => { const m = e.target.value as MfgMarket; set({ market: m, sizeIds: sizesForMarket(m).map((s) => s.id), factor: gtFactorFor(m), factorLinked: true }); }} aria-label="Mercado">
                          <option value="NATIONAL">Nacional</option><option value="EXPORT">Exportación</option>
                        </SelectInput></div>
                        <Checkbox label="Mayorista" checked={g.isWholesale} onChange={(e) => set({ isWholesale: e.target.checked })} />
                        <IconButton title="Eliminar grupo" tone="danger" onClick={() => setGroups(groups.filter((_, idx) => idx !== gi))} className="ml-auto"><Trash2 className="w-4 h-4" /></IconButton>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <Field label="Costo fijo adicional"><MoneyInput value={g.fixedCostExtra} onChange={(e) => set({ fixedCostExtra: e.target.value })} /></Field>
                              {Number(gt?.fixedCost) > 0 && (
                                <Checkbox className="mt-1.5 text-xs" checked={Number(g.fixedCostExtra) === Number(gt?.fixedCost)} onChange={(e) => set({ fixedCostExtra: e.target.checked ? String(gt?.fixedCost) : '0' })}
                                  label={<>Usar <b className="text-gray-900">{money(Number(gt?.fixedCost))}</b></>} />
                              )}
                            </div>
                            <div>
                              <Field label="Factor">
                                <AddonInput type="number" step="0.0001" min="0" prefix="x" suffix={`${groupProfitPct(g).toFixed(1)}%`} value={g.factor}
                                  onChange={(e) => set({ factor: e.target.value, factorLinked: false })} />
                              </Field>
                              {Number(sugFactor) > 0 && (
                                <Checkbox className="mt-1.5 text-xs" checked={g.factorLinked}
                                  onChange={(e) => set(e.target.checked ? { factor: sugFactor, factorLinked: true } : { factor, factorLinked: false })}
                                  label={<>Usar sugerido <b className="text-gray-900">x{Number(sugFactor)}</b></>} />
                              )}
                            </div>
                            <div>
                              <Field label="Precio de lista">
                                <AddonInput type="number" step="0.01" min="0" prefix={g.market === 'EXPORT' ? 'US$' : '$'} disabled={g.auto}
                                  value={g.auto ? groupPrice(g) : g.listPrice} onChange={(e) => set({ listPrice: e.target.value })} />
                              </Field>
                              <Checkbox className="mt-1.5 text-xs" checked={g.auto} onChange={(e) => set({ auto: e.target.checked })}
                                label={<>Automático: <b className="text-gray-900">{groupMoney(g, groupPrice(g))}</b></>} />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3">
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500">Precio final{g.market === 'EXPORT' && exchangeRate > 0 ? ` · tasa ${money(exchangeRate)}` : ''}</p>
                              {noRate && <p className="text-xs font-medium text-red-600">Sin tasa de cambio activa</p>}
                            </div>
                            <p className={`text-xl font-bold tabular-nums ${noRate ? 'text-red-600' : 'text-gray-900'}`}>{groupMoney(g, finalPrice)}</p>
                          </div>
                        </div>

                        {/* Tallas + recargo por color (con scroll al desbordar) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-1">Tallas del grupo</p>
                            {marketSizes.length === 0 ? <span className="text-xs text-gray-400">Sin tallas para {g.market === 'EXPORT' ? 'Exportación' : 'Nacional'}.</span> : (
                              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                {marketSizes.map((s) => {
                                  const on = g.sizeIds.includes(s.id);
                                  return (
                                    <button key={s.id} type="button" aria-pressed={on} onClick={() => set({ sizeIds: on ? g.sizeIds.filter((x) => x !== s.id) : [...g.sizeIds, s.id] })}
                                      className={`min-w-[2.25rem] h-7 px-2 rounded-md border text-xs font-medium transition-colors ${on ? 'border-app-500 bg-app-50 text-app-700' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}>{s.abbreviation}</button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          {refColors.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">Recargo por color</p>
                              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                {refColors.map((c) => (
                                  <div key={c.id} className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: c.hexCode }} />
                                    <span className="text-xs text-gray-600 flex-1 truncate">{c.name}</span>
                                    <input type="number" step="0.01" min="0" value={g.surcharges[c.id] ?? ''} onChange={(e) => set({ surcharges: { ...g.surcharges, [c.id]: e.target.value } })}
                                      placeholder="+$0" aria-label={`Recargo ${c.name}`} className={`${cellInput} w-20 h-7 text-right flex-shrink-0`} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!(exchangeRate > 0) && groups.some(needsRate) && (
              <div className="mt-4"><Alert tone="error" title="Sin tasa de cambio activa">Regístrala en Catálogos → Tasa de cambio para calcular los precios de exportación. No se puede guardar mientras falte.</Alert></div>
            )}
          </Card>
        </>
      )}
    </Page>
  );
}
