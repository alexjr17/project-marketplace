import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Check, Ban, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgDispatch, MfgDispatchItem } from '../../types/manufacturing';
import { DES_STATUS_META } from './DispatchesPage';

const TYPE_LABEL: Record<string, string> = { VENTA: 'Venta', CONSIGNACION: 'Consignación', TRASLADO: 'Traslado', MUESTRA: 'Muestra' };

export default function DispatchDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatchId = Number(id);
  const [d, setD] = useState<MfgDispatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Remisión / facturación (editable).
  const [bill, setBill] = useState({ shipmentNumber: '', invoiceNumber: '', invoicedAt: '' });

  const load = async () => {
    setLoading(true);
    try {
      const dd = await manufacturingService.getDispatch(dispatchId);
      setD(dd);
      setBill({ shipmentNumber: dd.shipmentNumber ?? '', invoiceNumber: dd.invoiceNumber ?? '', invoicedAt: dd.invoicedAt ?? '' });
    }
    catch { toast.error('No se pudo cargar el despacho'); }
    finally { setLoading(false); }
  };

  const saveBilling = async () => {
    setBusy(true);
    try {
      const dd = await manufacturingService.updateDispatchBilling(dispatchId, {
        shipmentNumber: bill.shipmentNumber.trim() || null,
        invoiceNumber: bill.invoiceNumber.trim() || null,
        invoicedAt: bill.invoicedAt || null,
      });
      setD(dd); toast.success('Facturación guardada');
    } catch (e: any) { toast.error(e?.message || 'No se pudo guardar'); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dispatchId]);

  const groups = useMemo(() => {
    if (!d) return [];
    const byRef = new Map<number, { ref: MfgDispatchItem['reference']; items: MfgDispatchItem[] }>();
    d.items.forEach((it) => {
      if (!byRef.has(it.referenceId)) byRef.set(it.referenceId, { ref: it.reference, items: [] });
      byRef.get(it.referenceId)!.items.push(it);
    });
    return [...byRef.values()].map(({ ref, items }) => {
      const colors = new Map<number, { name: string; hex: string }>();
      const sizes = new Map<number, { abbr: string; sort: number }>();
      const cell = new Map<string, number>();
      items.forEach((it) => {
        if (it.color) colors.set(it.colorId, { name: it.color.name, hex: it.color.hexCode });
        if (it.size) sizes.set(it.sizeId, { abbr: it.size.abbreviation, sort: it.size.sortOrder });
        cell.set(`${it.sizeId}-${it.colorId}`, it.quantity);
      });
      return {
        ref,
        S: [...sizes.entries()].sort((a, b) => a[1].sort - b[1].sort),
        C: [...colors.entries()],
        cell,
        total: items.reduce((t, it) => t + it.quantity, 0),
      };
    });
  }, [d]);

  const confirm = async () => {
    if (!window.confirm('¿Confirmar el despacho? Se descontará el inventario de producto terminado.')) return;
    setBusy(true);
    try { setD(await manufacturingService.confirmDispatch(dispatchId)); toast.success('Despacho confirmado'); }
    catch (e: any) { toast.error(e?.message || 'No se pudo confirmar'); }
    finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!window.confirm('¿Anular el despacho? Si estaba confirmado, se devuelve el inventario.')) return;
    setBusy(true);
    try { setD(await manufacturingService.cancelDispatch(dispatchId)); toast.success('Despacho anulado'); }
    catch (e: any) { toast.error(e?.message || 'No se pudo anular'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="py-16 text-center text-gray-400">Cargando…</div>;
  if (!d) return <div className="py-16 text-center text-gray-400">Despacho no encontrado.</div>;

  const total = d.items.reduce((t, it) => t + it.quantity, 0);

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate('/manufacturing/dispatches')} className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm">
        <ArrowLeft className="w-4 h-4" /> Volver a despachos
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 font-mono">{d.code}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DES_STATUS_META[d.status].cls}`}>{DES_STATUS_META[d.status].label}</span>
            </div>
            <p className="text-gray-700 font-medium mt-1">{d.client?.name ?? 'Sin cliente'}</p>
            <p className="text-sm text-gray-500 mt-1">
              {TYPE_LABEL[d.type] ?? d.type} · {d.warehouse ? `Bodega: ${d.warehouse.name} · ` : ''}
              {d.purchaseOrder ? <>Pedido: <Link to={`/manufacturing/purchase-orders/${d.purchaseOrderId}`} className="text-orange-600 font-mono">{d.purchaseOrder.code}</Link> · </> : ''}
              Total: {total} und
            </p>
            {d.notes && <p className="text-sm text-gray-500 mt-1">Notas: {d.notes}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            {d.status === 'DRAFT' && (
              <button onClick={confirm} disabled={busy} className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg disabled:opacity-50"><Check className="w-4 h-4" /> Confirmar despacho</button>
            )}
            {d.status !== 'CANCELLED' && (
              <button onClick={cancel} disabled={busy} className="inline-flex items-center gap-1 text-sm text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg"><Ban className="w-4 h-4" /> {d.status === 'CONFIRMED' ? 'Anular (devolver stock)' : 'Anular'}</button>
            )}
          </div>
        </div>
      </div>

      {d.status !== 'CANCELLED' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-3">Remisión / Facturación</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">N° remisión</span>
              <input value={bill.shipmentNumber} onChange={(e) => setBill({ ...bill, shipmentNumber: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">N° factura</span>
              <input value={bill.invoiceNumber} onChange={(e) => setBill({ ...bill, invoiceNumber: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Fecha facturación</span>
              <input type="date" value={bill.invoicedAt} onChange={(e) => setBill({ ...bill, invoicedAt: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="flex justify-end mt-3">
            <button onClick={saveBilling} disabled={busy} className="text-sm bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg disabled:opacity-60">Guardar facturación</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.ref?.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              {g.ref?.imagePath
                ? <img src={g.ref.imagePath} alt="" className="w-11 h-11 rounded-lg object-cover border border-gray-100" />
                : <div className="w-11 h-11 rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-gray-300"><Package className="w-5 h-5" /></div>}
              <div className="flex-1">
                <p className="font-semibold text-gray-900"><span className="font-mono text-gray-500">{g.ref?.code}</span> {g.ref?.name}</p>
                <p className="text-xs text-gray-500">{g.total} und</p>
              </div>
            </div>
            <div className="overflow-x-auto border border-gray-100 rounded-lg">
              <table className="text-sm w-full">
                <thead><tr className="bg-gray-50">
                  <th className="p-2 text-left text-gray-500 font-medium sticky left-0 bg-gray-50">Talla \ Color</th>
                  {g.C.map(([cid, c]) => <th key={cid} className="p-2 text-center font-medium text-gray-700 min-w-[72px]"><span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: c.hex }} />{c.name}</span></th>)}
                </tr></thead>
                <tbody>{g.S.map(([sid, s]) => (
                  <tr key={sid} className="border-t border-gray-100">
                    <td className="p-2 font-semibold text-gray-800 sticky left-0 bg-white">{s.abbr}</td>
                    {g.C.map(([cid]) => { const q = g.cell.get(`${sid}-${cid}`) ?? 0; return <td key={cid} className={`p-2 text-center ${q ? 'text-gray-700' : 'text-gray-300'}`}>{q || '—'}</td>; })}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
