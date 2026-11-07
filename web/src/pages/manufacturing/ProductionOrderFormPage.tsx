import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, ClipboardList, Shirt } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgReference, MfgWarehouse, MfgCollection, MfgProductionOrderInput, MfgMarket } from '../../types/manufacturing';
import {
  Page, PageHeader, Button, Card, CardTitle, Field, TextInput, SelectInput, DateInput, TextArea, RadioGroup, Combobox, FormGrid, FormActions,
  Spinner, EmptyState, Alert,
} from '../../components/ui';
import QtyMatrix from '../../components/manufacturing/QtyMatrix';

import { errorMessage } from '../../lib/http';
export default function ProductionOrderFormPage() {
  const navigate = useNavigate();
  const [references, setReferences] = useState<MfgReference[]>([]);
  const [warehouses, setWarehouses] = useState<MfgWarehouse[]>([]);
  const [collections, setCollections] = useState<MfgCollection[]>([]);
  const [referenceId, setReferenceId] = useState<number | ''>('');
  const [ref, setRef] = useState<MfgReference | null>(null);
  const [warehouseId, setWarehouseId] = useState<number | ''>('');
  const [collectionId, setCollectionId] = useState<number | ''>('');
  const [market, setMarket] = useState<MfgMarket>('NATIONAL');
  const [internalCode, setInternalCode] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [estimatedDeliveryAt, setEstimatedDeliveryAt] = useState('');
  const [notes, setNotes] = useState('');
  // qty[sizeId][colorId] = cantidad
  const [qty, setQty] = useState<Record<number, Record<number, string>>>({});

  const [loading, setLoading] = useState(true);
  const [loadingRef, setLoadingRef] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [refs, whs, cols] = await Promise.all([
          manufacturingService.getReferences(),
          manufacturingService.getWarehouses(),
          manufacturingService.getCollections(),
        ]);
        setReferences(refs);
        setWarehouses(whs);
        setCollections(cols);
      } catch {
        toast.error('No se pudieron cargar los datos');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onReferenceChange = async (value: number | '') => {
    setReferenceId(value);
    setRef(null);
    setQty({});
    if (value === '') return;
    setLoadingRef(true);
    try { setRef(await manufacturingService.getReference(Number(value))); }
    catch { toast.error('No se pudo cargar la referencia'); }
    finally { setLoadingRef(false); }
  };

  const sizes = useMemo(() => (ref?.sizes ?? []).map((s) => s.size!).filter(Boolean).filter((s) => (s.market ?? 'NATIONAL') === market).sort((a, b) => a.sortOrder - b.sortOrder), [ref, market]);
  const colors = useMemo(() => (ref?.colors ?? []).map((c) => c.color!).filter(Boolean), [ref]);

  const setCell = (sizeId: number, colorId: number, val: string) =>
    setQty((prev) => ({ ...prev, [sizeId]: { ...(prev[sizeId] ?? {}), [colorId]: val } }));

  const total = useMemo(() => {
    let t = 0;
    for (const s of Object.values(qty)) for (const v of Object.values(s)) t += Number(v) || 0;
    return t;
  }, [qty]);

  const save = async () => {
    if (referenceId === '') { toast.error('Selecciona una referencia'); return; }
    const items: MfgProductionOrderInput['items'] = [];
    for (const s of sizes) for (const c of colors) {
      const q = Number(qty[s.id]?.[c.id] ?? 0);
      if (q > 0) items.push({ colorId: c.id, sizeId: s.id, quantity: q });
    }
    if (items.length === 0) { toast.error('Ingresa al menos una cantidad'); return; }

    setSaving(true);
    try {
      const order = await manufacturingService.createProductionOrder({
        referenceId: Number(referenceId),
        warehouseId: warehouseId === '' ? null : Number(warehouseId),
        collectionId: collectionId === '' ? null : Number(collectionId),
        market,
        internalCode: internalCode.trim() || null,
        scheduledAt: scheduledAt || null,
        estimatedDeliveryAt: estimatedDeliveryAt || null,
        notes: notes.trim() || null,
        items,
      });
      toast.success('Orden creada');
      navigate(`/manufacturing/orders/${order.id}`);
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo crear la orden'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Page><Spinner label="Cargando…" /></Page>;

  return (
    <Page>
      <PageHeader icon={ClipboardList} backTo="/manufacturing/orders" title="Nueva orden de producción" subtitle="Elige la referencia y las cantidades por talla y color." />

      <Card>
        <CardTitle>Datos de la orden</CardTitle>
        <FormGrid>
          <Field label="Referencia" required>
            <Combobox options={references.map((r) => ({ value: r.id, label: `${r.code} · ${r.name}` }))} value={referenceId === '' ? null : referenceId}
              onChange={(v) => onReferenceChange(v === null ? '' : Number(v))} placeholder="Buscar referencia…" clearable={false} />
          </Field>
          <Field label="Bodega destino">
            <SelectInput value={warehouseId} onChange={(e) => setWarehouseId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">— Sin asignar —</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </SelectInput>
          </Field>
          <Field label="Código interno"><TextInput value={internalCode} onChange={(e) => setInternalCode(e.target.value)} placeholder="Ej. FAB-001" /></Field>
          <Field label="Colección">
            <SelectInput value={collectionId} onChange={(e) => setCollectionId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">— Sin colección —</option>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.name}{c.year ? ` (${c.year})` : ''}</option>)}
            </SelectInput>
          </Field>
          <Field label="Mercado" hint="Define las tallas de la matriz." className="md:col-span-2">
            <RadioGroup variant="segmented" value={market} onChange={(v) => setMarket(v as MfgMarket)}
              options={[{ value: 'NATIONAL', label: 'Nacional' }, { value: 'EXPORT', label: 'Exportación' }]} />
          </Field>
          <Field label="Fecha programada"><DateInput value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></Field>
          <Field label="Fecha de entrega estimada"><DateInput value={estimatedDeliveryAt} onChange={(e) => setEstimatedDeliveryAt(e.target.value)} /></Field>
          <Field label="Notas" className="md:col-span-2"><TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </FormGrid>
      </Card>

      <Card>
        <CardTitle actions={<span className="text-sm text-gray-500">Total: <b className="text-gray-900 tabular-nums">{total.toLocaleString('es-CO')}</b> und</span>}>Cantidades (talla × color)</CardTitle>
        {loadingRef ? <Spinner label="Cargando referencia…" />
          : !ref ? <EmptyState icon={Shirt} title="Selecciona una referencia" description="Al elegirla verás su matriz de tallas y colores." />
          : sizes.length === 0 || colors.length === 0 ? <Alert tone="warning">La referencia no tiene colores o tallas {market === 'EXPORT' ? 'de exportación' : 'nacionales'} en su ficha técnica.</Alert>
          : (
            <QtyMatrix
              totals
              sizes={sizes.map((s) => ({ id: s.id, label: s.abbreviation }))}
              colors={colors.map((c) => ({ id: c.id, name: c.name, hex: c.hexCode }))}
              get={(sid, cid) => Number(qty[sid]?.[cid] ?? 0) || 0}
              cell={(sid, cid) => (
                <input type="number" min="0" value={qty[sid]?.[cid] ?? ''} onChange={(e) => setCell(sid, cid, e.target.value)}
                  aria-label="Cantidad" placeholder="0"
                  className="w-20 h-8 rounded-md border border-gray-300 px-2 text-right text-sm tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500" />
              )}
            />
          )}
      </Card>

      <FormActions sticky>
        <Button variant="secondary" onClick={() => navigate('/manufacturing/orders')}>Cancelar</Button>
        <Button icon={<Save className="w-4 h-4" />} isLoading={saving} onClick={save}>Crear orden</Button>
      </FormActions>
    </Page>
  );
}
