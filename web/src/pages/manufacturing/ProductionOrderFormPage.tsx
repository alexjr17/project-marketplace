import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgReference, MfgWarehouse, MfgProductionOrderInput } from '../../types/manufacturing';

export default function ProductionOrderFormPage() {
  const navigate = useNavigate();
  const [references, setReferences] = useState<MfgReference[]>([]);
  const [warehouses, setWarehouses] = useState<MfgWarehouse[]>([]);
  const [referenceId, setReferenceId] = useState<number | ''>('');
  const [ref, setRef] = useState<MfgReference | null>(null);
  const [warehouseId, setWarehouseId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  // qty[sizeId][colorId] = cantidad
  const [qty, setQty] = useState<Record<number, Record<number, string>>>({});

  const [loading, setLoading] = useState(true);
  const [loadingRef, setLoadingRef] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [refs, whs] = await Promise.all([
          manufacturingService.getReferences(),
          manufacturingService.getWarehouses(),
        ]);
        setReferences(refs);
        setWarehouses(whs);
      } catch {
        toast.error('No se pudieron cargar los datos');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onReferenceChange = async (value: number | '') => {
    setReferenceId(value);
    setRef(null);
    setQty({});
    if (value === '') return;
    setLoadingRef(true);
    try { setRef(await manufacturingService.getReference(Number(value))); }
    catch { toast.error('No se pudo cargar la referencia'); }
    finally { setLoadingRef(false); }
  };

  const sizes = useMemo(() => (ref?.sizes ?? []).map((s) => s.size!).filter(Boolean).sort((a, b) => a.sortOrder - b.sortOrder), [ref]);
  const colors = useMemo(() => (ref?.colors ?? []).map((c) => c.color!).filter(Boolean), [ref]);

  const setCell = (sizeId: number, colorId: number, val: string) =>
    setQty((prev) => ({ ...prev, [sizeId]: { ...(prev[sizeId] ?? {}), [colorId]: val } }));

  const total = useMemo(() => {
    let t = 0;
    for (const s of Object.values(qty)) for (const v of Object.values(s)) t += Number(v) || 0;
    return t;
  }, [qty]);

  const save = async () => {
    if (referenceId === '') { toast.error('Selecciona una referencia'); return; }
    const items: MfgProductionOrderInput['items'] = [];
    for (const s of sizes) for (const c of colors) {
      const q = Number(qty[s.id]?.[c.id] ?? 0);
      if (q > 0) items.push({ colorId: c.id, sizeId: s.id, quantity: q });
    }
    if (items.length === 0) { toast.error('Ingresa al menos una cantidad'); return; }

    setSaving(true);
    try {
      const order = await manufacturingService.createProductionOrder({
        referenceId: Number(referenceId),
        warehouseId: warehouseId === '' ? null : Number(warehouseId),
        notes: notes.trim() || null,
        items,
      });
      toast.success('Orden creada');
      navigate(`/manufacturing/orders/${order.id}`);
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo crear la orden');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-16 text-center text-gray-400">Cargando…</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate('/manufacturing/orders')} className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm">
        <ArrowLeft className="w-4 h-4" /> Volver a órdenes
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nueva orden de producción</h1>

      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Referencia *</span>
            <select value={referenceId} onChange={(e) => onReferenceChange(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="">— Selecciona —</option>
              {references.map((r) => <option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Bodega destino</span>
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="">— Sin asignar —</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-700">Notas</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
          </label>
        </div>
      </section>

      {/* Matriz talla × color */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Cantidades (talla × color)</h2>
          <span className="text-sm text-gray-500">Total: <b className="text-gray-800">{total}</b></span>
        </div>

        {loadingRef ? (
          <div className="py-8 text-center text-gray-400">Cargando referencia…</div>
        ) : !ref ? (
          <div className="py-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-lg">Selecciona una referencia para ver su matriz.</div>
        ) : sizes.length === 0 || colors.length === 0 ? (
          <div className="py-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-lg">La referencia no tiene colores o tallas en su ficha técnica.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-left text-gray-500 font-medium sticky left-0 bg-white">Talla \ Color</th>
                  {colors.map((c) => (
                    <th key={c.id} className="p-2 text-center font-medium text-gray-700 min-w-[90px]">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: c.hexCode }} />
                        {c.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sizes.map((s) => (
                  <tr key={s.id}>
                    <td className="p-2 font-semibold text-gray-800 sticky left-0 bg-white">{s.abbreviation}</td>
                    {colors.map((c) => (
                      <td key={c.id} className="p-1">
                        <input type="number" min="0" value={qty[s.id]?.[c.id] ?? ''} onChange={(e) => setCell(s.id, c.id, e.target.value)}
                          className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-center" placeholder="0" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex justify-end gap-2 pb-8">
        <button onClick={() => navigate('/manufacturing/orders')} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700">Cancelar</button>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium disabled:opacity-60">
          <Save className="w-4 h-4" /> {saving ? 'Creando…' : 'Crear orden'}
        </button>
      </div>
    </div>
  );
}
