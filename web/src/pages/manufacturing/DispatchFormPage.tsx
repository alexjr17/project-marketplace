import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Package, Truck } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgClient, MfgWarehouse, MfgPurchaseOrder, MfgAvailableStock, MfgDispatchType } from '../../types/manufacturing';
import {
  Page, PageHeader, Button, Card, CardTitle, Field, SelectInput, TextArea, FormGrid, FormActions, Thumb, Spinner, EmptyState,
} from '../../components/ui';
import QtyMatrix from '../../components/manufacturing/QtyMatrix';

export default function DispatchFormPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<MfgClient[]>([]);
  const [warehouses, setWarehouses] = useState<MfgWarehouse[]>([]);
  const [pedidos, setPedidos] = useState<MfgPurchaseOrder[]>([]);
  const [available, setAvailable] = useState<MfgAvailableStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [clientId, setClientId] = useState<number | ''>('');
  const [warehouseId, setWarehouseId] = useState<number | ''>('');
  const [poId, setPoId] = useState<number | ''>('');
  const [type, setType] = useState<MfgDispatchType>('VENTA');
  const [notes, setNotes] = useState('');
  const [qty, setQty] = useState<Record<string, string>>({}); // `${refId}-${sizeId}-${colorId}`

  const loadAvailable = async (whId: number | '') => {
    setAvailable(await manufacturingService.getAvailableStock(whId === '' ? undefined : Number(whId)));
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [cl, whs, po, av] = await Promise.all([
          manufacturingService.getClients(),
          manufacturingService.getWarehouses(),
          manufacturingService.getPurchaseOrders({ status: 'IN_PRODUCTION' }),
          manufacturingService.getAvailableStock(),
        ]);
        setClients(cl); setWarehouses(whs); setPedidos(po); setAvailable(av);
      } catch { toast.error('No se pudieron cargar los datos'); }
      finally { setLoading(false); }
    })();
  }, []);

  const onWarehouse = async (v: number | '') => { setWarehouseId(v); setQty({}); try { await loadAvailable(v); } catch { /* noop */ } };

  // Prefill desde un pedido: cantidades = min(pendiente, disponible).
  const onPedido = async (v: number | '') => {
    setPoId(v);
    if (v === '') return;
    try {
      const res = await manufacturingService.getPoPending(Number(v));
      if (res.purchaseOrder.clientId) setClientId(res.purchaseOrder.clientId);
      const availMap = new Map(available.map((a) => [`${a.referenceId}-${a.sizeId}-${a.colorId}`, Number(a.available)]));
      const next: Record<string, string> = {};
      res.items.forEach((it) => {
        if (it.pending <= 0) return;
        const key = `${it.referenceId}-${it.sizeId}-${it.colorId}`;
        const avail = availMap.get(key) ?? 0;
        const q = Math.min(it.pending, avail);
        if (q > 0) next[key] = String(q);
      });
      setQty(next);
      toast.success('Cantidades pendientes precargadas (según disponibilidad)');
    } catch { toast.error('No se pudo cargar el pedido'); }
  };

  // Agrupa disponibilidad por referencia → matriz color×talla.
  const groups = useMemo(() => {
    const byRef = new Map<number, { refCode: string; refName: string; imagePath?: string | null; colors: Map<number, { name: string; hex: string }>; sizes: Map<number, { abbr: string; sort: number }>; avail: Map<string, number> }>();
    available.forEach((a) => {
      if (!byRef.has(a.referenceId)) byRef.set(a.referenceId, { refCode: a.refCode, refName: a.refName, imagePath: a.imagePath, colors: new Map(), sizes: new Map(), avail: new Map() });
      const g = byRef.get(a.referenceId)!;
      g.colors.set(a.colorId, { name: a.colorName, hex: a.colorHex });
      g.sizes.set(a.sizeId, { abbr: a.sizeAbbr, sort: a.sizeSort });
      g.avail.set(`${a.sizeId}-${a.colorId}`, Number(a.available));
    });
    return [...byRef.entries()].map(([refId, g]) => ({
      refId, ...g,
      S: [...g.sizes.entries()].sort((x, y) => x[1].sort - y[1].sort),
      C: [...g.colors.entries()],
    }));
  }, [available]);

  const total = useMemo(() => Object.values(qty).reduce((t, v) => t + (Number(v) || 0), 0), [qty]);

  const save = async () => {
    const items: { referenceId: number; colorId: number; sizeId: number; quantity: number }[] = [];
    for (const [key, v] of Object.entries(qty)) {
      const q = Number(v) || 0;
      if (q <= 0) continue;
      const [refId, sizeId, colorId] = key.split('-').map(Number);
      items.push({ referenceId: refId, colorId, sizeId, quantity: q });
    }
    if (items.length === 0) { toast.error('Ingresa cantidades a despachar'); return; }
    setSaving(true);
    try {
      const d = await manufacturingService.createDispatch({
        clientId: clientId === '' ? null : Number(clientId),
        purchaseOrderId: poId === '' ? null : Number(poId),
        warehouseId: warehouseId === '' ? null : Number(warehouseId),
        type, notes: notes.trim() || null, items,
      });
      toast.success('Despacho creado');
      navigate(`/manufacturing/dispatches/${d.id}`);
    } catch (e: any) { toast.error(e?.message || 'No se pudo crear el despacho'); }
    finally { setSaving(false); }
  };

  if (loading) return <Page><Spinner label="Cargando…" /></Page>;

  return (
    <Page>
      <PageHeader icon={Truck} backTo="/manufacturing/dispatches" title="Nuevo despacho" subtitle="Elige el origen y las cantidades a entregar por talla y color." />

      <Card>
        <CardTitle>Datos del despacho</CardTitle>
        <FormGrid>
          <Field label="Cliente">
            <SelectInput value={clientId} onChange={(e) => setClientId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">— Sin asignar —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectInput>
          </Field>
          <Field label="Desde pedido (opcional)" hint="Precarga las cantidades pendientes según disponibilidad.">
            <SelectInput value={poId} onChange={(e) => onPedido(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">— Ninguno —</option>
              {pedidos.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.client?.name ?? ''}</option>)}
            </SelectInput>
          </Field>
          <Field label="Bodega origen">
            <SelectInput value={warehouseId} onChange={(e) => onWarehouse(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">Todas</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </SelectInput>
          </Field>
          <Field label="Tipo">
            <SelectInput value={type} onChange={(e) => setType(e.target.value as MfgDispatchType)}>
              <option value="VENTA">Venta</option>
              <option value="CONSIGNACION">Consignación</option>
              <option value="TRASLADO">Traslado</option>
              <option value="MUESTRA">Muestra</option>
            </SelectInput>
          </Field>
          <Field label="Notas" className="md:col-span-2"><TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </FormGrid>
      </Card>

      <Card>
        <CardTitle actions={<span className="text-sm text-gray-500">A despachar: <b className="text-gray-900 tabular-nums">{total.toLocaleString('es-CO')}</b> und</span>}>Producto disponible</CardTitle>
        {groups.length === 0 ? (
          <EmptyState icon={Package} title="Sin producto disponible" description={`No hay producto terminado disponible${warehouseId !== '' ? ' en esta bodega' : ''}.`} />
        ) : (
          <div className="divide-y divide-gray-100">
            {groups.map((g) => (
              <div key={g.refId} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3 mb-3">
                  <Thumb src={g.imagePath} alt={g.refName} />
                  <p className="font-medium text-gray-900"><span className="font-mono text-gray-500 mr-1">{g.refCode}</span>{g.refName}</p>
                </div>
                <QtyMatrix
                  sizes={g.S.map(([sid, s]) => ({ id: sid, label: s.abbr }))}
                  colors={g.C.map(([cid, c]) => ({ id: cid, name: c.name, hex: c.hex }))}
                  get={(sid, cid) => g.avail.get(`${sid}-${cid}`) ?? 0}
                  cell={(sid, cid, avail) => {
                    const key = `${g.refId}-${sid}-${cid}`;
                    return avail > 0 ? (
                      <span className="inline-flex flex-col items-end">
                        <input type="number" min="0" max={avail} value={qty[key] ?? ''} onChange={(e) => setQty((p) => ({ ...p, [key]: e.target.value }))}
                          aria-label="Cantidad a despachar" placeholder="0"
                          className="w-16 h-8 rounded-md border border-gray-300 px-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500" />
                        <span className="text-[10px] text-gray-400">de {avail}</span>
                      </span>
                    ) : '—';
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      <FormActions sticky>
        <Button variant="secondary" onClick={() => navigate('/manufacturing/dispatches')}>Cancelar</Button>
        <Button icon={<Save className="w-4 h-4" />} isLoading={saving} onClick={save}>Crear despacho</Button>
      </FormActions>
    </Page>
  );
}
