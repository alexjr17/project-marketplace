import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Truck, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgDispatch, MfgDispatchStatus } from '../../types/manufacturing';

export const DES_STATUS_META: Record<MfgDispatchStatus, { label: string; cls: string }> = {
  DRAFT: { label: 'Borrador', cls: 'bg-gray-100 text-gray-600' },
  CONFIRMED: { label: 'Confirmado', cls: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Anulado', cls: 'bg-red-100 text-red-700' },
};

export default function DispatchesPage() {
  const [items, setItems] = useState<MfgDispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getDispatches(status ? { status } : undefined)); }
    catch { toast.error('No se pudieron cargar los despachos'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);

  const remove = async (o: MfgDispatch) => {
    if (!confirm(`¿Eliminar el despacho ${o.code}?`)) return;
    try { await manufacturingService.deleteDispatch(o.id); toast.success('Despacho eliminado'); load(); }
    catch (e: any) { toast.error(e?.message || 'No se pudo eliminar'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg"><Truck className="w-6 h-6 text-orange-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Despachos</h1>
            <p className="text-sm text-gray-500">Entrega de producto terminado; descuenta el inventario por lote.</p>
          </div>
        </div>
        <Link to="/manufacturing/dispatches/new" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg">
          <Plus className="w-4 h-4" /> Nuevo despacho
        </Link>
      </div>

      <div className="mb-4">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Todos los estados</option>
          {(Object.keys(DES_STATUS_META) as MfgDispatchStatus[]).map((s) => <option key={s} value={s}>{DES_STATUS_META[s].label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Despacho</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Pedido</th>
              <th className="px-4 py-3 font-medium">Líneas</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sin despachos. Crea el primero.</td></tr>
            ) : items.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-semibold text-gray-800">{o.code}</td>
                <td className="px-4 py-3 text-gray-700">{o.client?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600 font-mono">{o.purchaseOrder?.code ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{o.items_count ?? o.items?.length ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DES_STATUS_META[o.status].cls}`}>{DES_STATUS_META[o.status].label}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link to={`/manufacturing/dispatches/${o.id}`} className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Eye className="w-4 h-4" /></Link>
                    {o.status !== 'CONFIRMED' && <button onClick={() => remove(o)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
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
