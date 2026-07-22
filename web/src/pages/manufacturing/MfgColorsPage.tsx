import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Palette } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgColor } from '../../types/manufacturing';

const empty = { name: '', hexCode: '#3B82F6', code: '', isActive: true };

export default function MfgColorsPage() {
  const [items, setItems] = useState<MfgColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgColor | null>(null);
  const [form, setForm] = useState<Partial<MfgColor>>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getColors()); }
    catch { toast.error('No se pudieron cargar los colores'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (c: MfgColor) => { setEditing(c); setForm({ ...c }); setModal(true); };

  const save = async () => {
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      if (editing) { await manufacturingService.updateColor(editing.id, form); toast.success('Color actualizado'); }
      else { await manufacturingService.createColor(form); toast.success('Color creado'); }
      setModal(false); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (c: MfgColor) => {
    if (!confirm(`¿Eliminar el color "${c.name}"?`)) return;
    try { await manufacturingService.deleteColor(c.id); toast.success('Eliminado'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg"><Palette className="w-6 h-6 text-orange-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Colores</h1>
            <p className="text-sm text-gray-500">Colores propios de Fábrica. El código (2 díg.) se usa en el código de barras.</p>
          </div>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg">
          <Plus className="w-4 h-4" /> Nuevo color
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Color</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Sin colores. Crea el primero.</td></tr>
            ) : items.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3"><span className="w-6 h-6 rounded-full border border-gray-200 inline-block" style={{ backgroundColor: c.hexCode }} /></td>
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 font-mono text-gray-600">{c.code || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.isActive ? 'Activo' : 'Inactivo'}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(c)} className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(c)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editing ? 'Editar color' : 'Nuevo color'}</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Nombre *</span>
                <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Azul Marino" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Color</span>
                  <div className="mt-1 flex items-center gap-2">
                    <input type="color" value={form.hexCode ?? '#000000'} onChange={(e) => setForm({ ...form, hexCode: e.target.value })} className="w-10 h-10 rounded border border-gray-300 p-0.5" />
                    <input value={form.hexCode ?? ''} onChange={(e) => setForm({ ...form, hexCode: e.target.value })} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm" />
                  </div>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Código (barcode)</span>
                  <input value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} maxLength={10} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 font-mono" placeholder="01" />
                </label>
              </div>
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
    </div>
  );
}
