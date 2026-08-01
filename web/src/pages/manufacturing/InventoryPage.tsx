import { useEffect, useMemo, useState } from 'react';
import { Boxes, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgWarehouseStock, MfgWarehouse as MfgWh } from '../../types/manufacturing';

interface RefGroup {
  id: number;
  code: string;
  name: string;
  sizes: { id: number; abbr: string; sort: number }[];
  colors: { id: number; name: string; hex: string }[];
  cell: Record<string, number>; // `${sizeId}-${colorId}` = cantidad
  total: number;
}

export default function InventoryPage() {
  const [rows, setRows] = useState<MfgWarehouseStock[]>([]);
  const [warehouses, setWarehouses] = useState<MfgWh[]>([]);
  const [whId, setWhId] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = async () => {
    setLoading(true);
    try { setRows(await manufacturingService.getInventory(whId === '' ? undefined : Number(whId))); }
    catch { toast.error('No se pudo cargar el inventario'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [whId]);
  useEffect(() => { manufacturingService.getWarehouses().then(setWarehouses).catch(() => {}); }, []);

  // Agrupa por REFERENCIA (consolidando las bodegas del filtro) para mostrar la matriz talla × color.
  const byReference = useMemo(() => {
    const g: Record<number, RefGroup> = {};
    rows.forEach((r) => {
      if (!r.reference) return;
      const ref = g[r.referenceId] ?? (g[r.referenceId] = {
        id: r.referenceId, code: r.reference.code, name: r.reference.name, sizes: [], colors: [], cell: {}, total: 0,
      });
      if (r.size && !ref.sizes.some((s) => s.id === r.sizeId)) ref.sizes.push({ id: r.sizeId, abbr: r.size.abbreviation, sort: r.size.sortOrder });
      if (r.color && !ref.colors.some((c) => c.id === r.colorId)) ref.colors.push({ id: r.colorId, name: r.color.name, hex: r.color.hexCode });
      ref.cell[`${r.sizeId}-${r.colorId}`] = (ref.cell[`${r.sizeId}-${r.colorId}`] ?? 0) + r.quantity;
      ref.total += r.quantity;
    });
    return Object.values(g)
      .map((ref) => ({ ...ref, sizes: ref.sizes.sort((a, b) => a.sort - b.sort) }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [rows]);

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const colTotal = (ref: RefGroup, colorId: number) => ref.sizes.reduce((t, s) => t + (ref.cell[`${s.id}-${colorId}`] ?? 0), 0);
  const rowTotal = (ref: RefGroup, sizeId: number) => ref.colors.reduce((t, c) => t + (ref.cell[`${sizeId}-${c.id}`] ?? 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg"><Boxes className="w-6 h-6 text-orange-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
            <p className="text-sm text-gray-500">Producto terminado por referencia. Haz clic en una referencia para ver su matriz de cantidades.</p>
          </div>
        </div>
        <select value={whId} onChange={(e) => setWhId(e.target.value === '' ? '' : Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Todas las bodegas</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {loading ? <div className="py-16 text-center text-gray-400">Cargando…</div>
        : byReference.length === 0 ? <div className="py-16 text-center text-gray-400">Sin existencias. Se llenan al completar órdenes de producción.</div>
        : (
          <div className="space-y-3">
            {byReference.map((ref) => {
              const open = expanded.has(ref.id);
              return (
                <div key={ref.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <button onClick={() => toggle(ref.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate"><span className="font-mono text-gray-500">{ref.code}</span> {ref.name}</p>
                      <p className="text-xs text-gray-500">{ref.sizes.length} talla{ref.sizes.length !== 1 ? 's' : ''} · {ref.colors.length} color{ref.colors.length !== 1 ? 'es' : ''}</p>
                    </div>
                    <span className="text-sm text-gray-600 flex-shrink-0">Total: <b className="text-gray-900">{ref.total}</b> und</span>
                  </button>

                  {open && (
                    <div className="border-t border-gray-100 p-4 overflow-x-auto">
                      <table className="text-sm w-full">
                        <thead><tr className="bg-gray-50">
                          <th className="p-2 text-left text-gray-500 font-medium sticky left-0 bg-gray-50">Talla \ Color</th>
                          {ref.colors.map((c) => (
                            <th key={c.id} className="p-2 text-center font-medium text-gray-700 min-w-[72px]"><span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: c.hex }} />{c.name}</span></th>
                          ))}
                          <th className="p-2 text-center font-medium text-gray-700">Total</th>
                        </tr></thead>
                        <tbody>
                          {ref.sizes.map((s) => (
                            <tr key={s.id} className="border-t border-gray-100">
                              <td className="p-2 font-semibold text-gray-800 sticky left-0 bg-white">{s.abbr}</td>
                              {ref.colors.map((c) => {
                                const q = ref.cell[`${s.id}-${c.id}`] ?? 0;
                                return <td key={c.id} className={`p-2 text-center ${q ? 'text-gray-700' : 'text-gray-300'}`}>{q || '—'}</td>;
                              })}
                              <td className="p-2 text-center font-semibold text-gray-800 bg-gray-50">{rowTotal(ref, s.id)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot><tr className="border-t border-gray-200 bg-gray-50">
                          <td className="p-2 text-left text-xs font-medium text-gray-600">Total</td>
                          {ref.colors.map((c) => <td key={c.id} className="p-2 text-center text-sm font-semibold text-gray-800">{colTotal(ref, c.id)}</td>)}
                          <td className="p-2 text-center text-sm font-bold text-gray-900">{ref.total}</td>
                        </tr></tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
