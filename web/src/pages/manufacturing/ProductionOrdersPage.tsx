import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, ClipboardList, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgProductionOrder, MfgOrderStatus } from '../../types/manufacturing';

export const STATUS_META: Record<MfgOrderStatus, { label: string; cls: string }> = {
  DRAFT: { label: 'Borrador', cls: 'bg-gray-100 text-gray-600' },
  PROGRAMMED: { label: 'Programada', cls: 'bg-blue-100 text-blue-700' },
  IN_PROCESS: { label: 'En proceso', cls: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: 'Completada', cls: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-red-100 text-red-700' },
};

export default function ProductionOrdersPage() {
  const [items, setItems] = useState<MfgProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getProductionOrders(status ? { status } : undefined)); }
    catch { toast.error('No se pudieron cargar las órdenes'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);

  const remove = async (o: MfgProductionOrder) => {
    if (!confirm(`¿Eliminar la orden ${o.code}?`)) return;
    try { await manufacturingService.deleteProductionOrder(o.id); toast.success('Orden eliminada'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg"><ClipboardList className="w-6 h-6 text-orange-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Órdenes de producción</h1>
            <p className="text-sm text-gray-500">Crea órdenes y sigue su avance por etapas.</p>
          </div>
        </div>
        <Link to="/manufacturing/orders/new" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg">
          <Plus className="w-4 h-4" /> Nueva orden
        </Link>
      </div>

      <div className="mb-4">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Todos los estados</option>
          {(Object.keys(STATUS_META) as MfgOrderStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Orden</th>
              <th className="px-4 py-3 font-medium">Referencia</th>
              <th className="px-4 py-3 font-medium">Líneas</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Sin órdenes. Crea la primera.</td></tr>
            ) : items.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-semibold text-gray-800">{o.code}</td>
                <td className="px-4 py-3 text-gray-700">{o.reference ? `${o.reference.code} · ${o.reference.name}` : '—'}</td>
                <td className="px-4 py-3 text-gray-600">{o.items_count ?? o.items?.length ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_META[o.status].cls}`}>{STATUS_META[o.status].label}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link to={`/manufacturing/orders/${o.id}`} className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Eye className="w-4 h-4" /></Link>
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
