import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Factory, Ban, Package, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgPurchaseOrder, MfgPurchaseOrderItem } from '../../types/manufacturing';
import { PED_STATUS_META } from './PurchaseOrdersPage';

export default function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const orderId = Number(id);
  const [order, setOrder] = useState<MfgPurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setOrder(await manufacturingService.getPurchaseOrder(orderId)); }
    catch { toast.error('No se pudo cargar el pedido'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orderId]);

  // Agrupa los ítems por referencia → matriz talla×color.
  const groups = useMemo(() => {
    if (!order) return [];
    const byRef = new Map<number, { ref: MfgPurchaseOrderItem['reference']; items: MfgPurchaseOrderItem[] }>();
    order.items.forEach((it) => {
      if (!byRef.has(it.referenceId)) byRef.set(it.referenceId, { ref: it.reference, items: [] });
      byRef.get(it.referenceId)!.items.push(it);
    });
    return [...byRef.values()].map(({ ref, items }) => {
      const colors = new Map<number, { name: string; hex: string }>();
      const sizes = new Map<number, { abbr: string; sort: number }>();
      const cell = new Map<string, number>();
      let produced = false;
      items.forEach((it) => {
        if (it.color) colors.set(it.colorId, { name: it.color.name, hex: it.color.hexCode });
        if (it.size) sizes.set(it.sizeId, { abbr: it.size.abbreviation, sort: it.size.sortOrder });
        cell.set(`${it.sizeId}-${it.colorId}`, it.quantity);
        if (it.productionOrderId) produced = true;
      });
      const S = [...sizes.entries()].sort((a, b) => a[1].sort - b[1].sort);
      const C = [...colors.entries()];
      const total = items.reduce((t, it) => t + it.quantity, 0);
      return { ref, S, C, cell, total, produced };
    });
  }, [order]);

  const generate = async () => {
    if (!confirm('¿Generar las órdenes de producción de este pedido? Se creará una por cada referencia pendiente.')) return;
    setBusy(true);
    try {
      const res = await manufacturingService.generateProduction(orderId);
      toast.success(`Se generaron ${res.created} orden(es) de producción`);
      setOrder(res.purchaseOrder);
    } catch (e: any) { toast.error(e?.message || 'No se pudo generar la producción'); }
    finally { setBusy(false); }
  };

  const changeStatus = async (status: MfgPurchaseOrder['status']) => {
    setBusy(true);
    try { setOrder(await manufacturingService.changePurchaseStatus(orderId, status)); toast.success('Estado actualizado'); }
    catch { toast.error('No se pudo actualizar'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="py-16 text-center text-gray-400">Cargando…</div>;
  if (!order) return <div className="py-16 text-center text-gray-400">Pedido no encontrado.</div>;

  const totalQty = order.items.reduce((t, it) => t + it.quantity, 0);
  const pendingRefs = groups.filter((g) => !g.produced).length;

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => navigate('/manufacturing/purchase-orders')} className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm">
        <ArrowLeft className="w-4 h-4" /> Volver a pedidos
      </button>

      {/* Cabecera */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 font-mono">{order.code}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PED_STATUS_META[order.status].cls}`}>{PED_STATUS_META[order.status].label}</span>
            </div>
            <p className="text-gray-700 font-medium mt-1">{order.client?.name}{order.client?.city ? ` · ${order.client.city}` : ''}</p>
            <p className="text-sm text-gray-500 mt-1">
              {order.collection ? `Colección: ${order.collection.name} · ` : ''}{`${order.market === 'EXPORT' ? 'Exportación' : 'Nacional'} · `}
              {(order.dispatchStartDate || order.deliveryDate) ? `Entrega: ${order.dispatchStartDate ?? '…'} → ${order.deliveryDate ?? '…'} · ` : ''}Total: {totalQty} und
            </p>
            {order.partialDates && order.partialDates.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">Entregas parciales: {order.partialDates.join(' · ')}</p>
            )}
            {order.notes && <p className="text-sm text-gray-500 mt-1">Notas: {order.notes}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <button onClick={generate} disabled={busy || pendingRefs === 0} title={pendingRefs === 0 ? 'Todas las referencias ya están en producción' : undefined}
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              <Factory className="w-4 h-4" /> Generar producción{pendingRefs > 0 ? ` (${pendingRefs})` : ''}
            </button>
            {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && !order.productionOrders?.length && (
              <button onClick={() => changeStatus('CANCELLED')} disabled={busy} className="inline-flex items-center gap-1 text-sm text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg"><Ban className="w-4 h-4" /> Cancelar pedido</button>
            )}
            {order.status === 'IN_PRODUCTION' && (
              <button onClick={() => changeStatus('DELIVERED')} disabled={busy} className="inline-flex items-center gap-1 text-sm text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-lg">Marcar entregado</button>
            )}
          </div>
        </div>
      </div>

      {/* Órdenes de producción generadas */}
      {order.productionOrders && order.productionOrders.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <div className="flex items-center gap-2 mb-3"><ClipboardList className="w-5 h-5 text-orange-600" /><h2 className="font-semibold text-gray-900">Producción generada</h2></div>
          <div className="flex flex-wrap gap-2">
            {order.productionOrders.map((p) => (
              <Link key={p.id} to={`/manufacturing/orders/${p.id}`} className="inline-flex items-center gap-2 border border-gray-200 hover:border-orange-300 hover:bg-orange-50 rounded-lg px-3 py-2 text-sm">
                <span className="font-mono font-semibold text-gray-800">{p.code}</span>
                <span className="text-gray-500">{p.reference?.code ?? ''}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Referencias del pedido (matrices) */}
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.ref?.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              {g.ref?.imagePath
                ? <img src={g.ref.imagePath} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-100" />
                : <div className="w-12 h-12 rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-gray-300"><Package className="w-5 h-5" /></div>}
              <div className="flex-1">
                <p className="font-semibold text-gray-900"><span className="font-mono text-gray-500">{g.ref?.code}</span> {g.ref?.name}</p>
                <p className="text-xs text-gray-500">{g.total} und</p>
              </div>
              {g.produced && <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">En producción</span>}
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
