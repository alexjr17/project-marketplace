import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, ShoppingCart, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgPurchaseOrder, MfgPurchaseStatus } from '../../types/manufacturing';

export const PED_STATUS_META: Record<MfgPurchaseStatus, { label: string; cls: string }> = {
  DRAFT: { label: 'Borrador', cls: 'bg-gray-100 text-gray-600' },
  APPROVED: { label: 'Aprobado', cls: 'bg-blue-100 text-blue-700' },
  IN_PRODUCTION: { label: 'En producción', cls: 'bg-amber-100 text-amber-700' },
  DELIVERED: { label: 'Entregado', cls: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelado', cls: 'bg-red-100 text-red-700' },
};

export default function PurchaseOrdersPage() {
  const [items, setItems] = useState<MfgPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getPurchaseOrders(status ? { status } : undefined)); }
    catch { toast.error('No se pudieron cargar los pedidos'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);

  const remove = async (o: MfgPurchaseOrder) => {
    if (!confirm(`¿Eliminar el pedido ${o.code}?`)) return;
    try { await manufacturingService.deletePurchaseOrder(o.id); toast.success('Pedido eliminado'); load(); }
    catch (e: any) { toast.error(e?.message || 'No se pudo eliminar'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg"><ShoppingCart className="w-6 h-6 text-orange-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
            <p className="text-sm text-gray-500">Pedidos de clientes. Desde un pedido se genera la producción.</p>
          </div>
        </div>
        <Link to="/manufacturing/purchase-orders/new" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg">
          <Plus className="w-4 h-4" /> Nuevo pedido
        </Link>
      </div>

      <div className="mb-4">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Todos los estados</option>
          {(Object.keys(PED_STATUS_META) as MfgPurchaseStatus[]).map((s) => <option key={s} value={s}>{PED_STATUS_META[s].label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Pedido</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Colección</th>
              <th className="px-4 py-3 font-medium">Líneas</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sin pedidos. Crea el primero.</td></tr>
            ) : items.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-semibold text-gray-800">{o.code}</td>
                <td className="px-4 py-3 text-gray-700">{o.client?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{o.collection?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{o.items_count ?? o.items?.length ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PED_STATUS_META[o.status].cls}`}>{PED_STATUS_META[o.status].label}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link to={`/manufacturing/purchase-orders/${o.id}`} className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Eye className="w-4 h-4" /></Link>
                    <button onClick={() => remove(o)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
