import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgReference, MfgClient, MfgCollection, MfgPurchaseOrderInput, MfgMarket } from '../../types/manufacturing';

interface Line { ref: MfgReference; qty: Record<number, Record<number, string>>; } // qty[sizeId][colorId]

export default function PurchaseOrderFormPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<MfgClient[]>([]);
  const [collections, setCollections] = useState<MfgCollection[]>([]);
  const [references, setReferences] = useState<MfgReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [clientId, setClientId] = useState<number | ''>('');
  const [collectionId, setCollectionId] = useState<number | ''>('');
  const [market, setMarket] = useState<MfgMarket>('NATIONAL');
  const [dispatchStartDate, setDispatchStartDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [partialDates, setPartialDates] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const [pickRef, setPickRef] = useState<number | ''>('');
  const [adding, setAdding] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [cl, co, refs] = await Promise.all([
          manufacturingService.getClients(),
          manufacturingService.getCollections(),
          manufacturingService.getReferences(),
        ]);
        setClients(cl); setCollections(co); setReferences(refs);
      } catch { toast.error('No se pudieron cargar los datos'); }
      finally { setLoading(false); }
    })();
  }, []);

  const addReference = async () => {
    if (pickRef === '') return;
    if (lines.some((l) => l.ref.id === pickRef)) { toast.error('Esa referencia ya está en el pedido'); return; }
    setAdding(true);
    try {
      const ref = await manufacturingService.getReference(Number(pickRef));
      setLines((prev) => [...prev, { ref, qty: {} }]);
      setPickRef('');
    } catch { toast.error('No se pudo cargar la referencia'); }
    finally { setAdding(false); }
  };

  const removeLine = (refId: number) => setLines((prev) => prev.filter((l) => l.ref.id !== refId));
  const setCell = (refId: number, sizeId: number, colorId: number, val: string) =>
    setLines((prev) => prev.map((l) => l.ref.id !== refId ? l : { ...l, qty: { ...l.qty, [sizeId]: { ...(l.qty[sizeId] ?? {}), [colorId]: val } } }));

  const lineTotal = (l: Line) => { let t = 0; for (const r of Object.values(l.qty)) for (const v of Object.values(r)) t += Number(v) || 0; return t; };
  const grandTotal = useMemo(() => lines.reduce((t, l) => t + lineTotal(l), 0), [lines]);

  const save = async () => {
    if (clientId === '') { toast.error('Selecciona un cliente'); return; }
    if (lines.length === 0) { toast.error('Agrega al menos una referencia'); return; }
    const refsPayload: MfgPurchaseOrderInput['references'] = [];
    for (const l of lines) {
      const sizes = (l.ref.sizes ?? []).map((s) => s.size!).filter(Boolean).filter((s) => (s.market ?? 'NATIONAL') === market);
      const colors = (l.ref.colors ?? []).map((c) => c.color!).filter(Boolean);
      const items: { colorId: number; sizeId: number; quantity: number }[] = [];
      for (const s of sizes) for (const c of colors) {
        const q = Number(l.qty[s.id]?.[c.id] ?? 0);
        if (q > 0) items.push({ colorId: c.id, sizeId: s.id, quantity: q });
      }
      if (items.length) refsPayload.push({ referenceId: l.ref.id, items });
    }
    if (refsPayload.length === 0) { toast.error('Ingresa cantidades en al menos una referencia'); return; }

    setSaving(true);
    try {
      const order = await manufacturingService.createPurchaseOrder({
        clientId: Number(clientId),
        collectionId: collectionId === '' ? null : Number(collectionId),
        market,
        dispatchStartDate: dispatchStartDate || null,
        deliveryDate: deliveryDate || null,
        partialDates: partialDates.filter(Boolean),
        notes: notes.trim() || null,
        references: refsPayload,
      });
      toast.success('Pedido creado');
      navigate(`/manufacturing/purchase-orders/${order.id}`);
    } catch (e: any) { toast.error(e?.message || 'No se pudo crear el pedido'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="py-16 text-center text-gray-400">Cargando…</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate('/manufacturing/purchase-orders')} className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm">
        <ArrowLeft className="w-4 h-4" /> Volver a pedidos
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo pedido</h1>

      {/* Datos del pedido */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Cliente *</span>
            <select value={clientId} onChange={(e) => setClientId(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="">— Selecciona —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.city ? ` · ${c.city}` : ''}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Colección</span>
            <select value={collectionId} onChange={(e) => setCollectionId(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="">— Sin asignar —</option>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Mercado</span>
            <select value={market} onChange={(e) => setMarket(e.target.value as MfgMarket)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="NATIONAL">Nacional</option>
              <option value="EXPORT">Exportación</option>
            </select>
            <span className="text-[11px] text-gray-400">Define las tallas de la matriz.</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Entrega desde</span>
            <input type="date" value={dispatchStartDate} onChange={(e) => setDispatchStartDate(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Entrega hasta</span>
            <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
          </label>
          {/* Entregas parciales (hasta 4 fechas) */}
          <div className="block sm:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Entregas parciales</span>
              {partialDates.length < 4 && (
                <button type="button" onClick={() => setPartialDates((p) => [...p, ''])} className="text-sm text-orange-600 hover:underline">+ Agregar fecha</button>
              )}
            </div>
            {partialDates.length === 0 ? (
              <p className="text-xs text-gray-400 mt-1">Opcional: agrega fechas de entregas parciales.</p>
            ) : (
              <div className="mt-1 space-y-2">
                {partialDates.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-8">#{i + 1}</span>
                    <input type="date" value={d} onChange={(e) => setPartialDates((p) => p.map((x, j) => j === i ? e.target.value : x))} className="flex-1 border border-gray-300 rounded-lg px-3 py-2" />
                    <button type="button" onClick={() => setPartialDates((p) => p.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-700">Notas</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
          </label>
        </div>
      </section>

      {/* Agregar referencias */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Referencias del pedido</h2>
          <span className="text-sm text-gray-500">Total: <b className="text-gray-800">{grandTotal}</b> und</span>
        </div>
        <div className="flex items-end gap-2 mb-4">
          <label className="flex-1 block">
            <span className="text-sm font-medium text-gray-700">Agregar referencia</span>
            <select value={pickRef} onChange={(e) => setPickRef(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="">— Selecciona —</option>
              {references.filter((r) => !lines.some((l) => l.ref.id === r.id)).map((r) => <option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}
            </select>
          </label>
          <button onClick={addReference} disabled={adding || pickRef === ''} className="inline-flex items-center gap-1 bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg disabled:opacity-50"><Plus className="w-4 h-4" /> Agregar</button>
        </div>

        {lines.length === 0 ? (
          <div className="py-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-lg">Agrega referencias y define sus cantidades por talla × color.</div>
        ) : (
          <div className="space-y-4">
            {lines.map((l) => {
              const sizes = (l.ref.sizes ?? []).map((s) => s.size!).filter(Boolean).filter((s) => (s.market ?? 'NATIONAL') === market).sort((a, b) => a.sortOrder - b.sortOrder);
              const colors = (l.ref.colors ?? []).map((c) => c.color!).filter(Boolean);
              return (
                <div key={l.ref.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      {l.ref.imagePath
                        ? <img src={l.ref.imagePath} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-100" />
                        : <div className="w-12 h-12 rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-gray-300"><Package className="w-5 h-5" /></div>}
                      <div>
                        <p className="font-semibold text-gray-900"><span className="font-mono text-gray-500">{l.ref.code}</span> {l.ref.name}</p>
                        <p className="text-xs text-gray-500">Subtotal: {lineTotal(l)} und</p>
                      </div>
                    </div>
                    <button onClick={() => removeLine(l.ref.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  {sizes.length === 0 || colors.length === 0 ? (
                    <p className="text-sm text-gray-400">La referencia no tiene colores o tallas en su ficha técnica.</p>
                  ) : (
                    <div className="overflow-x-auto border border-gray-100 rounded-lg">
                      <table className="text-sm w-full">
                        <thead><tr className="bg-gray-50">
                          <th className="p-2 text-left text-gray-500 font-medium sticky left-0 bg-gray-50">Talla \ Color</th>
                          {colors.map((c) => <th key={c.id} className="p-2 text-center font-medium text-gray-700 min-w-[80px]"><span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: c.hexCode }} />{c.name}</span></th>)}
                        </tr></thead>
                        <tbody>{sizes.map((s) => (
                          <tr key={s.id} className="border-t border-gray-100">
                            <td className="p-2 font-semibold text-gray-800 sticky left-0 bg-white">{s.abbreviation}</td>
                            {colors.map((c) => (
                              <td key={c.id} className="p-1.5 text-center">
                                <input type="number" min="0" value={l.qty[s.id]?.[c.id] ?? ''} onChange={(e) => setCell(l.ref.id, s.id, c.id, e.target.value)}
                                  className="w-16 border border-gray-300 rounded px-1.5 py-1 text-center text-sm" placeholder="0" />
                              </td>
                            ))}
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex justify-end gap-2 pb-8">
        <button onClick={() => navigate('/manufacturing/purchase-orders')} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700">Cancelar</button>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium disabled:opacity-60">
          <Save className="w-4 h-4" /> {saving ? 'Creando…' : 'Crear pedido'}
        </button>
      </div>
    </div>
  );
}
