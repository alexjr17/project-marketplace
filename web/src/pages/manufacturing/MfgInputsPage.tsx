import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Box, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgInput, MfgInputType, MfgInputBatch, MfgColor } from '../../types/manufacturing';

const money = (n: number) => '$' + n.toLocaleString('es-CO', { maximumFractionDigits: 2 });

const empty = { code: '', name: '', inputTypeId: undefined as number | undefined, unitOfMeasure: 'und', scope: null as MfgInput['scope'], notes: '', isActive: true };

export default function MfgInputsPage() {
  const [items, setItems] = useState<MfgInput[]>([]);
  const [types, setTypes] = useState<MfgInputType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgInput | null>(null);
  const [form, setForm] = useState<Partial<MfgInput>>(empty);
  const [saving, setSaving] = useState(false);

  // Lotes / precios del insumo.
  const [colors, setColors] = useState<MfgColor[]>([]);
  const [batchInput, setBatchInput] = useState<MfgInput | null>(null);
  const [batches, setBatches] = useState<MfgInputBatch[]>([]);
  const [batchAvg, setBatchAvg] = useState(0);
  const [batchForm, setBatchForm] = useState({ colorId: '' as number | '', unitCost: '', quantity: '', purchasedAt: '', reference: '' });

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getInputs()); }
    catch { toast.error('No se pudieron cargar los insumos'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); manufacturingService.getInputTypes().then(setTypes).catch(() => {}); manufacturingService.getColors().then(setColors).catch(() => {}); }, []);

  const openBatches = async (i: MfgInput) => {
    setBatchInput(i); setBatchForm({ colorId: '', unitCost: '', quantity: '', purchasedAt: '', reference: '' });
    try { const d = await manufacturingService.getInputBatches(i.id); setBatches(d.batches); setBatchAvg(d.average); }
    catch { setBatches([]); setBatchAvg(0); }
  };
  const addBatch = async () => {
    if (!batchInput) return;
    if (batchForm.unitCost === '' || Number(batchForm.unitCost) <= 0) { toast.error('Ingresa el precio del lote'); return; }
    try {
      await manufacturingService.createInputBatch(batchInput.id, {
        colorId: batchForm.colorId === '' ? null : Number(batchForm.colorId),
        unitCost: Number(batchForm.unitCost), quantity: batchForm.quantity === '' ? null : Number(batchForm.quantity),
        purchasedAt: batchForm.purchasedAt || null, reference: batchForm.reference.trim() || null,
      });
      toast.success('Lote registrado');
      const d = await manufacturingService.getInputBatches(batchInput.id); setBatches(d.batches); setBatchAvg(d.average);
      setBatchForm({ colorId: '', unitCost: '', quantity: '', purchasedAt: '', reference: '' });
    } catch { toast.error('No se pudo registrar'); }
  };
  const removeBatch = async (b: MfgInputBatch) => {
    if (!batchInput) return;
    try { await manufacturingService.deleteInputBatch(batchInput.id, b.id); const d = await manufacturingService.getInputBatches(batchInput.id); setBatches(d.batches); setBatchAvg(d.average); }
    catch { toast.error('No se pudo eliminar'); }
  };

  const selectedType = types.find((t) => t.id === form.inputTypeId);
  const isService = selectedType?.classification === 'SERVICIO';

  const openNew = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (i: MfgInput) => { setEditing(i); setForm({ ...i }); setModal(true); };

  const save = async () => {
    if (!form.code?.trim()) { toast.error('El código es obligatorio'); return; }
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      if (editing) { await manufacturingService.updateInput(editing.id, form); toast.success('Insumo actualizado'); }
      else { await manufacturingService.createInput(form); toast.success('Insumo creado'); }
      setModal(false); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (i: MfgInput) => {
    if (!confirm(`¿Eliminar el insumo "${i.name}"?`)) return;
    try { await manufacturingService.deleteInput(i.id); toast.success('Eliminado'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg"><Box className="w-6 h-6 text-orange-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Insumos</h1>
            <p className="text-sm text-gray-500">Materiales propios de Fábrica para la ficha técnica.</p>
          </div>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg">
          <Plus className="w-4 h-4" /> Nuevo insumo
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Unidad</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sin insumos. Crea el primero.</td></tr>
            ) : items.map((i) => (
              <tr key={i.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-gray-700">{i.code}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {i.name}
                  {i.inputType?.classification === 'SERVICIO' && <span className="ml-2 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-medium">{i.scope === 'EXTERNAL' ? 'Servicio ext.' : i.scope === 'INTERNAL' ? 'Servicio int.' : 'Servicio'}</span>}
                </td>
                <td className="px-4 py-3 text-gray-600">{i.inputType?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{i.unitOfMeasure}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${i.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{i.isActive ? 'Activo' : 'Inactivo'}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {i.inputType?.classification !== 'SERVICIO' && <button onClick={() => openBatches(i)} title="Lotes / precios" className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Coins className="w-4 h-4" /></button>}
                    <button onClick={() => openEdit(i)} className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(i)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editing ? 'Editar insumo' : 'Nuevo insumo'}</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Código *</span>
                  <input value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 font-mono" placeholder="TEL-01" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Unidad</span>
                  <input value={form.unitOfMeasure ?? ''} onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="m, kg, und…" />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Nombre *</span>
                <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Tela algodón" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Tipo de insumo</span>
                <select value={form.inputTypeId ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : Number(e.target.value); const t = types.find((x) => x.id === v); setForm({ ...form, inputTypeId: v, scope: t?.classification === 'SERVICIO' ? (form.scope ?? 'INTERNAL') : null }); }} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">— Sin tipo —</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.classification === 'SERVICIO' ? 'Servicio' : 'Producto'})</option>)}
                </select>
              </label>
              {isService && (
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Alcance del servicio</span>
                  <select value={form.scope ?? 'INTERNAL'} onChange={(e) => setForm({ ...form, scope: e.target.value as MfgInput['scope'] })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                    <option value="INTERNAL">Interno (mano de obra propia)</option>
                    <option value="EXTERNAL">Externo (taller / maquila)</option>
                  </select>
                </label>
              )}
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Notas</span>
                <textarea value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <span className="text-sm text-gray-700">Activo</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700">Cancelar</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium disabled:opacity-60">{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de lotes / precios del insumo */}
      {batchInput && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setBatchInput(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-900">Lotes / precios · {batchInput.name}</h2>
              <button onClick={() => setBatchInput(null)} className="text-gray-400 hover:text-gray-700 text-sm">Cerrar</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Registra las compras del insumo con su precio. En la ficha técnica se traen para decidir el precio. Promedio actual: <b className="text-gray-700">{money(batchAvg)}</b></p>

            {/* Alta de lote */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end bg-gray-50 rounded-lg p-3 mb-4">
              <label className="block"><span className="text-xs text-gray-500">Color</span>
                <select value={batchForm.colorId} onChange={(e) => setBatchForm({ ...batchForm, colorId: e.target.value === '' ? '' : Number(e.target.value) })} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                  <option value="">—</option>{colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block"><span className="text-xs text-gray-500">Precio unit. *</span><input type="number" step="0.01" min="0" value={batchForm.unitCost} onChange={(e) => setBatchForm({ ...batchForm, unitCost: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" /></label>
              <label className="block"><span className="text-xs text-gray-500">Cantidad</span><input type="number" step="0.0001" min="0" value={batchForm.quantity} onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" /></label>
              <label className="block"><span className="text-xs text-gray-500">Fecha</span><input type="date" value={batchForm.purchasedAt} onChange={(e) => setBatchForm({ ...batchForm, purchasedAt: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" /></label>
              <button onClick={addBatch} className="inline-flex items-center justify-center gap-1 bg-slate-700 hover:bg-slate-800 text-white px-3 py-2 rounded-lg text-sm"><Plus className="w-4 h-4" /> Agregar</button>
            </div>

            {batches.length === 0 ? <p className="text-sm text-gray-400">Sin lotes registrados.</p> : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-left"><tr>
                  <th className="px-3 py-2 font-medium">Color</th><th className="px-3 py-2 font-medium">Fecha</th><th className="px-3 py-2 font-medium">Precio</th><th className="px-3 py-2 font-medium">Cant.</th><th className="px-3 py-2" />
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {batches.map((b) => (
                    <tr key={b.id}>
                      <td className="px-3 py-2">{b.color ? <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: b.color.hexCode }} />{b.color.name}</span> : '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{b.purchasedAt ?? '—'}</td>
                      <td className="px-3 py-2 font-medium text-gray-800">{money(Number(b.unitCost))}</td>
                      <td className="px-3 py-2 text-gray-600">{b.quantity ?? '—'}</td>
                      <td className="px-3 py-2 text-right"><button onClick={() => removeBatch(b)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
