import { useEffect, useMemo, useState } from 'react';
import { Boxes, Warehouse } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgWarehouseStock, MfgWarehouse as MfgWh } from '../../types/manufacturing';

export default function InventoryPage() {
  const [rows, setRows] = useState<MfgWarehouseStock[]>([]);
  const [warehouses, setWarehouses] = useState<MfgWh[]>([]);
  const [whId, setWhId] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setRows(await manufacturingService.getInventory(whId === '' ? undefined : Number(whId))); }
    catch { toast.error('No se pudo cargar el inventario'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [whId]);
  useEffect(() => { manufacturingService.getWarehouses().then(setWarehouses).catch(() => {}); }, []);

  // Agrupa por bodega.
  const byWarehouse = useMemo(() => {
    const g: Record<string, { name: string; rows: MfgWarehouseStock[]; total: number }> = {};
    rows.forEach((r) => {
      const key = r.warehouse?.name ?? 'Bodega';
      (g[key] ||= { name: key, rows: [], total: 0 });
      g[key].rows.push(r);
      g[key].total += r.quantity;
    });
    return Object.values(g);
  }, [rows]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg"><Boxes className="w-6 h-6 text-orange-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
            <p className="text-sm text-gray-500">Producto terminado por bodega (se llena con los lotes de producción).</p>
          </div>
        </div>
        <select value={whId} onChange={(e) => setWhId(e.target.value === '' ? '' : Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Todas las bodegas</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {loading ? <div className="py-16 text-center text-gray-400">Cargando…</div>
        : byWarehouse.length === 0 ? <div className="py-16 text-center text-gray-400">Sin existencias. Se llenan al completar órdenes de producción.</div>
        : (
          <div className="space-y-5">
            {byWarehouse.map((wh) => (
              <div key={wh.name} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <span className="inline-flex items-center gap-2 font-semibold text-gray-800"><Warehouse className="w-4 h-4 text-gray-500" /> {wh.name}</span>
                  <span className="text-sm text-gray-500">Total: <b className="text-gray-800">{wh.total}</b> und</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-gray-500 text-left">
                    <tr>
                      <th className="px-4 py-2 font-medium">Referencia</th>
                      <th className="px-4 py-2 font-medium">Color</th>
                      <th className="px-4 py-2 font-medium">Talla</th>
                      <th className="px-4 py-2 font-medium text-right">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {wh.rows.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2"><span className="font-mono text-gray-700">{r.reference?.code}</span> <span className="text-gray-500">{r.reference?.name}</span></td>
                        <td className="px-4 py-2"><span className="inline-flex items-center gap-1.5 text-gray-700"><span className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: r.color?.hexCode }} />{r.color?.name}</span></td>
                        <td className="px-4 py-2 font-medium text-gray-800">{r.size?.abbreviation}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-900">{r.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
