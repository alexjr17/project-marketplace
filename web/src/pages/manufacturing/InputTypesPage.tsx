import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Boxes } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgInputType } from '../../types/manufacturing';

const empty = { name: '', classification: 'PRODUCTO' as const, consumesByColor: false, description: '', isActive: true };
const CLASS_LABEL: Record<string, string> = { PRODUCTO: 'Producto', SERVICIO: 'Servicio' };

export default function InputTypesPage() {
  const [items, setItems] = useState<MfgInputType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgInputType | null>(null);
  const [form, setForm] = useState<Partial<MfgInputType>>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getInputTypes()); }
    catch { toast.error('No se pudieron cargar los tipos de insumo'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (t: MfgInputType) => { setEditing(t); setForm({ ...t }); setModal(true); };

  const save = async () => {
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      if (editing) { await manufacturingService.updateInputType(editing.id, form); toast.success('Tipo de insumo actualizado'); }
      else { await manufacturingService.createInputType(form); toast.success('Tipo de insumo creado'); }
      setModal(false); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (t: MfgInputType) => {
    if (!confirm(`¿Eliminar el tipo de insumo "${t.name}"?`)) return;
    try { await manufacturingService.deleteInputType(t.id); toast.success('Eliminado'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg"><Boxes className="w-6 h-6 text-orange-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tipos de insumo</h1>
            <p className="text-sm text-gray-500">Clasifican los insumos: Producto (material) o Servicio (mano de obra).</p>
          </div>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg">
          <Plus className="w-4 h-4" /> Nuevo tipo
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Clasificación</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Sin tipos de insumo. Crea el primero.</td></tr>
            ) : items.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.classification === 'SERVICIO' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>{CLASS_LABEL[t.classification] ?? 'Producto'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{t.isActive ? 'Activo' : 'Inactivo'}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(t)} className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(t)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editing ? 'Editar tipo de insumo' : 'Nuevo tipo de insumo'}</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Nombre *</span>
                <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Telas, Hilos, Servicios…" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Clasificación</span>
                <select value={form.classification ?? 'PRODUCTO'} onChange={(e) => setForm({ ...form, classification: e.target.value as MfgInputType['classification'] })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="PRODUCTO">Producto (se consume en inventario)</option>
                  <option value="SERVICIO">Servicio (mano de obra, no se consume)</option>
                </select>
              </label>
              {form.classification !== 'SERVICIO' && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.consumesByColor ?? false} onChange={(e) => setForm({ ...form, consumesByColor: e.target.checked })} />
                  <span className="text-sm text-gray-700">Se consume por color (como las telas)</span>
                </label>
              )}
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Descripción</span>
                <textarea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Estado</span>
                <select value={(form.isActive ?? true) ? '1' : '0'} onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="1">Activo</option><option value="0">Inactivo</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700">Cancelar</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium disabled:opacity-60">{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
