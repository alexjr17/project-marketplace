import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgClient, MfgWarehouse, MfgPurchaseOrder, MfgAvailableStock, MfgDispatchType } from '../../types/manufacturing';

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

  if (loading) return <div className="py-16 text-center text-gray-400">Cargando…</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate('/manufacturing/dispatches')} className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm">
        <ArrowLeft className="w-4 h-4" /> Volver a despachos
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo despacho</h1>

      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Cliente</span>
            <select value={clientId} onChange={(e) => setClientId(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="">— Sin asignar —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Desde pedido (opcional)</span>
            <select value={poId} onChange={(e) => onPedido(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="">— Ninguno —</option>
              {pedidos.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.client?.name ?? ''}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Bodega origen</span>
            <select value={warehouseId} onChange={(e) => onWarehouse(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Todas</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Tipo</span>
            <select value={type} onChange={(e) => setType(e.target.value as MfgDispatchType)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="VENTA">Venta</option>
              <option value="CONSIGNACION">Consignación</option>
              <option value="TRASLADO">Traslado</option>
              <option value="MUESTRA">Muestra</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-700">Notas</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
          </label>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Producto disponible</h2>
          <span className="text-sm text-gray-500">A despachar: <b className="text-gray-800">{total}</b> und</span>
        </div>
        {groups.length === 0 ? (
          <div className="py-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-lg">No hay producto terminado disponible{warehouseId !== '' ? ' en esta bodega' : ''}.</div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.refId} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  {g.imagePath
                    ? <img src={g.imagePath} alt="" className="w-11 h-11 rounded-lg object-cover border border-gray-100" />
                    : <div className="w-11 h-11 rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-gray-300"><Package className="w-5 h-5" /></div>}
                  <p className="font-semibold text-gray-900"><span className="font-mono text-gray-500">{g.refCode}</span> {g.refName}</p>
                </div>
                <div className="overflow-x-auto border border-gray-100 rounded-lg">
                  <table className="text-sm w-full">
                    <thead><tr className="bg-gray-50">
                      <th className="p-2 text-left text-gray-500 font-medium sticky left-0 bg-gray-50">Talla \ Color</th>
                      {g.C.map(([cid, c]) => <th key={cid} className="p-2 text-center font-medium text-gray-700 min-w-[84px]"><span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: c.hex }} />{c.name}</span></th>)}
                    </tr></thead>
                    <tbody>{g.S.map(([sid, s]) => (
                      <tr key={sid} className="border-t border-gray-100">
                        <td className="p-2 font-semibold text-gray-800 sticky left-0 bg-white">{s.abbr}</td>
                        {g.C.map(([cid]) => {
                          const avail = g.avail.get(`${sid}-${cid}`) ?? 0;
                          const key = `${g.refId}-${sid}-${cid}`;
                          return (
                            <td key={cid} className="p-1.5 text-center">
                              {avail > 0 ? (
                                <>
                                  <input type="number" min="0" max={avail} value={qty[key] ?? ''} onChange={(e) => setQty((p) => ({ ...p, [key]: e.target.value }))}
                                    className="w-14 border border-gray-300 rounded px-1 py-1 text-center text-sm" placeholder="0" />
                                  <div className="text-[10px] text-gray-400">de {avail}</div>
                                </>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex justify-end gap-2 pb-8">
        <button onClick={() => navigate('/manufacturing/dispatches')} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700">Cancelar</button>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium disabled:opacity-60">
          <Save className="w-4 h-4" /> {saving ? 'Creando…' : 'Crear despacho'}
        </button>
      </div>
    </div>
  );
}
