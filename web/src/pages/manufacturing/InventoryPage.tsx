import { useEffect, useMemo, useState } from 'react';
import { Boxes, ChevronDown, Shirt } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgWarehouseStock, MfgWarehouse as MfgWh } from '../../types/manufacturing';
import { Page, PageHeader, Card, StatCard, FilterBar, SearchInput, SelectInput, EmptyState, Spinner } from '../../components/ui';
import QtyMatrix from '../../components/manufacturing/QtyMatrix';
import { matchText } from '../../components/manufacturing/mfgUi';

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
  const [q, setQ] = useState('');

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


  const shown = byReference.filter((r) => matchText(q, r.code, r.name));
  const totalUnits = byReference.reduce((t, r) => t + r.total, 0);

  return (
    <Page>
      <PageHeader icon={Boxes} title="Inventario" subtitle="Producto terminado por referencia. Abre una referencia para ver su matriz talla × color." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Shirt} label="Referencias con stock" value={byReference.length.toLocaleString('es-CO')} />
        <StatCard icon={Boxes} tone="green" label="Unidades" value={totalUnits.toLocaleString('es-CO')} hint={whId === '' ? 'Todas las bodegas' : warehouses.find((w) => w.id === whId)?.name} />
      </div>

      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar referencia…" />
        <SelectInput value={whId} onChange={(e) => setWhId(e.target.value === '' ? '' : Number(e.target.value))} aria-label="Bodega">
          <option value="">Todas las bodegas</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </SelectInput>
      </FilterBar>

      {loading ? <Card><Spinner label="Cargando…" /></Card>
        : byReference.length === 0 ? <Card><EmptyState icon={Boxes} title="Sin existencias" description="Se llenan al completar órdenes de producción." /></Card>
        : shown.length === 0 ? <Card><EmptyState title="Sin resultados para la búsqueda" /></Card>
        : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {shown.map((ref) => {
              const open = expanded.has(ref.id);
              return (
                <div key={ref.id}>
                  <button type="button" onClick={() => toggle(ref.id)} aria-expanded={open} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate"><span className="font-mono text-gray-500 mr-1">{ref.code}</span>{ref.name}</p>
                      <p className="text-xs text-gray-500">{ref.sizes.length} talla{ref.sizes.length !== 1 ? 's' : ''} · {ref.colors.length} color{ref.colors.length !== 1 ? 'es' : ''}</p>
                    </div>
                    <span className="text-sm text-gray-500 flex-shrink-0 tabular-nums"><b className="text-gray-900">{ref.total.toLocaleString('es-CO')}</b> und</span>
                  </button>
                  {open && (
                    <div className="px-4 pb-4">
                      <QtyMatrix
                        totals
                        sizes={ref.sizes.map((s) => ({ id: s.id, label: s.abbr }))}
                        colors={ref.colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex }))}
                        get={(sid, cid) => ref.cell[`${sid}-${cid}`] ?? 0}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </Page>
  );
}
