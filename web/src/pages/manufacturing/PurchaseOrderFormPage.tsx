import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Plus, Trash2, Package, ShoppingCart } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgReference, MfgClient, MfgCollection, MfgPurchaseOrderInput, MfgMarket } from '../../types/manufacturing';
import {
  Page, PageHeader, Button, IconButton, Card, CardTitle, Field, SelectInput, DateInput, TextArea, RadioGroup, Combobox, FormGrid, FormActions,
  Thumb, Spinner, EmptyState, Alert,
} from '../../components/ui';
import QtyMatrix from '../../components/manufacturing/QtyMatrix';

import { errorMessage } from '../../lib/http';
interface Line { ref: MfgReference; qty: Record<number, Record<number, string>>; } // qty[sizeId][colorId]

export default function PurchaseOrderFormPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<MfgClient[]>([]);
  const [collections, setCollections] = useState<MfgCollection[]>([]);
  const [references, setReferences] = useState<MfgReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [clientId, setClientId] = useState<number | ''>('');
  const [collectionId, setCollectionId] = useState<number | ''>('');
  const [market, setMarket] = useState<MfgMarket>('NATIONAL');
  const [dispatchStartDate, setDispatchStartDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [partialDates, setPartialDates] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const [pickRef, setPickRef] = useState<number | ''>('');
  const [adding, setAdding] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [cl, co, refs] = await Promise.all([
          manufacturingService.getClients(),
          manufacturingService.getCollections(),
          manufacturingService.getReferences(),
        ]);
        setClients(cl); setCollections(co); setReferences(refs);
      } catch { toast.error('No se pudieron cargar los datos'); }
      finally { setLoading(false); }
    })();
  }, []);

  const addReference = async () => {
    if (pickRef === '') return;
    if (lines.some((l) => l.ref.id === pickRef)) { toast.error('Esa referencia ya está en el pedido'); return; }
    setAdding(true);
    try {
      const ref = await manufacturingService.getReference(Number(pickRef));
      setLines((prev) => [...prev, { ref, qty: {} }]);
      setPickRef('');
    } catch { toast.error('No se pudo cargar la referencia'); }
    finally { setAdding(false); }
  };

  const removeLine = (refId: number) => setLines((prev) => prev.filter((l) => l.ref.id !== refId));
  const setCell = (refId: number, sizeId: number, colorId: number, val: string) =>
    setLines((prev) => prev.map((l) => l.ref.id !== refId ? l : { ...l, qty: { ...l.qty, [sizeId]: { ...(l.qty[sizeId] ?? {}), [colorId]: val } } }));

  const lineTotal = (l: Line) => { let t = 0; for (const r of Object.values(l.qty)) for (const v of Object.values(r)) t += Number(v) || 0; return t; };
  const grandTotal = useMemo(() => lines.reduce((t, l) => t + lineTotal(l), 0), [lines]);

  const save = async () => {
    if (clientId === '') { toast.error('Selecciona un cliente'); return; }
    if (lines.length === 0) { toast.error('Agrega al menos una referencia'); return; }
    const refsPayload: MfgPurchaseOrderInput['references'] = [];
    for (const l of lines) {
      const sizes = (l.ref.sizes ?? []).map((s) => s.size!).filter(Boolean).filter((s) => (s.market ?? 'NATIONAL') === market);
      const colors = (l.ref.colors ?? []).map((c) => c.color!).filter(Boolean);
      const items: { colorId: number; sizeId: number; quantity: number }[] = [];
      for (const s of sizes) for (const c of colors) {
        const q = Number(l.qty[s.id]?.[c.id] ?? 0);
        if (q > 0) items.push({ colorId: c.id, sizeId: s.id, quantity: q });
      }
      if (items.length) refsPayload.push({ referenceId: l.ref.id, items });
    }
    if (refsPayload.length === 0) { toast.error('Ingresa cantidades en al menos una referencia'); return; }

    setSaving(true);
    try {
      const order = await manufacturingService.createPurchaseOrder({
        clientId: Number(clientId),
        collectionId: collectionId === '' ? null : Number(collectionId),
        market,
        dispatchStartDate: dispatchStartDate || null,
        deliveryDate: deliveryDate || null,
        partialDates: partialDates.filter(Boolean),
        notes: notes.trim() || null,
        references: refsPayload,
      });
      toast.success('Pedido creado');
      navigate(`/manufacturing/purchase-orders/${order.id}`);
    } catch (e) { toast.error(errorMessage(e, 'No se pudo crear el pedido')); }
    finally { setSaving(false); }
  };

  if (loading) return <Page><Spinner label="Cargando…" /></Page>;

  const refOptions = references.filter((r) => !lines.some((l) => l.ref.id === r.id)).map((r) => ({ value: r.id, label: `${r.code} · ${r.name}` }));

  return (
    <Page>
      <PageHeader icon={ShoppingCart} backTo="/manufacturing/purchase-orders" title="Nuevo pedido" subtitle="Datos del cliente, fechas de entrega y cantidades por referencia." />

      <Card>
        <CardTitle>Datos del pedido</CardTitle>
        <FormGrid>
          <Field label="Cliente" required>
            <SelectInput value={clientId} onChange={(e) => setClientId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">— Selecciona —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.city ? ` · ${c.city}` : ''}</option>)}
            </SelectInput>
          </Field>
          <Field label="Colección">
            <SelectInput value={collectionId} onChange={(e) => setCollectionId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">— Sin asignar —</option>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectInput>
          </Field>
          <Field label="Mercado" hint="Define las tallas de la matriz." className="md:col-span-2">
            <RadioGroup variant="segmented" value={market} onChange={(v) => setMarket(v as MfgMarket)}
              options={[{ value: 'NATIONAL', label: 'Nacional' }, { value: 'EXPORT', label: 'Exportación' }]} />
          </Field>
          <Field label="Entrega desde"><DateInput value={dispatchStartDate} onChange={(e) => setDispatchStartDate(e.target.value)} /></Field>
          <Field label="Entrega hasta"><DateInput value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></Field>
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">Entregas parciales</span>
              {partialDates.length < 4 && (
                <Button size="sm" variant="ghost" icon={<Plus className="w-4 h-4" />} onClick={() => setPartialDates((p) => [...p, ''])}>Agregar fecha</Button>
              )}
            </div>
            {partialDates.length === 0 ? (
              <p className="text-xs text-gray-500">Opcional: hasta 4 fechas de entregas parciales.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {partialDates.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-6 tabular-nums">#{i + 1}</span>
                    <DateInput value={d} onChange={(e) => setPartialDates((p) => p.map((x, j) => j === i ? e.target.value : x))} aria-label={`Entrega parcial ${i + 1}`} />
                    <IconButton title="Quitar fecha" tone="danger" onClick={() => setPartialDates((p) => p.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></IconButton>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Field label="Notas" className="md:col-span-2"><TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </FormGrid>
      </Card>

      <Card>
        <CardTitle actions={<span className="text-sm text-gray-500">Total: <b className="text-gray-900 tabular-nums">{grandTotal.toLocaleString('es-CO')}</b> und</span>}>Referencias del pedido</CardTitle>
        <div className="flex flex-col sm:flex-row sm:items-end gap-2 mb-5">
          <Field label="Agregar referencia" className="flex-1">
            <Combobox options={refOptions} value={pickRef === '' ? null : pickRef} onChange={(v) => setPickRef(v === null ? '' : Number(v))} placeholder="Buscar referencia…" />
          </Field>
          <Button variant="outline" icon={<Plus className="w-4 h-4" />} isLoading={adding} disabled={pickRef === ''} onClick={addReference}>Agregar</Button>
        </div>

        {lines.length === 0 ? (
          <EmptyState icon={Package} title="Sin referencias" description="Agrega referencias y define sus cantidades por talla × color." />
        ) : (
          <div className="divide-y divide-gray-100">
            {lines.map((l) => {
              const sizes = (l.ref.sizes ?? []).map((s) => s.size!).filter(Boolean).filter((s) => (s.market ?? 'NATIONAL') === market).sort((a, b) => a.sortOrder - b.sortOrder);
              const colors = (l.ref.colors ?? []).map((c) => c.color!).filter(Boolean);
              return (
                <div key={l.ref.id} className="py-5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 mb-3">
                    <Thumb src={l.ref.imagePath} alt={l.ref.name} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate"><span className="font-mono text-gray-500 mr-1">{l.ref.code}</span>{l.ref.name}</p>
                      <p className="text-xs text-gray-500 tabular-nums">Subtotal: {lineTotal(l).toLocaleString('es-CO')} und</p>
                    </div>
                    <IconButton title="Quitar referencia" tone="danger" onClick={() => removeLine(l.ref.id)}><Trash2 className="w-4 h-4" /></IconButton>
                  </div>
                  {sizes.length === 0 || colors.length === 0 ? (
                    <Alert tone="warning">La referencia no tiene colores o tallas {market === 'EXPORT' ? 'de exportación' : 'nacionales'} en su ficha técnica.</Alert>
                  ) : (
                    <QtyMatrix
                      totals
                      sizes={sizes.map((s) => ({ id: s.id, label: s.abbreviation }))}
                      colors={colors.map((c) => ({ id: c.id, name: c.name, hex: c.hexCode }))}
                      get={(sid, cid) => Number(l.qty[sid]?.[cid] ?? 0) || 0}
                      cell={(sid, cid) => (
                        <input type="number" min="0" value={l.qty[sid]?.[cid] ?? ''} onChange={(e) => setCell(l.ref.id, sid, cid, e.target.value)}
                          aria-label="Cantidad" placeholder="0"
                          className="w-16 h-8 rounded-md border border-gray-300 px-2 text-right text-sm tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500" />
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <FormActions sticky>
        <Button variant="secondary" onClick={() => navigate('/manufacturing/purchase-orders')}>Cancelar</Button>
        <Button icon={<Save className="w-4 h-4" />} isLoading={saving} onClick={save}>Crear pedido</Button>
      </FormActions>
    </Page>
  );
}
