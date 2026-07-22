import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, CalendarRange } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgCollection } from '../../types/manufacturing';

const empty = { name: '', year: undefined as number | undefined, semester: '', isActive: true };

export default function CollectionsPage() {
  const [items, setItems] = useState<MfgCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgCollection | null>(null);
  const [form, setForm] = useState<Partial<MfgCollection>>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getCollections()); }
    catch { toast.error('No se pudieron cargar las colecciones'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (c: MfgCollection) => { setEditing(c); setForm({ ...c, semester: c.semester ?? '' }); setModal(true); };

  const save = async () => {
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    const payload = { ...form, semester: form.semester || null, year: form.year || null };
    setSaving(true);
    try {
      if (editing) { await manufacturingService.updateCollection(editing.id, payload); toast.success('Colección actualizada'); }
      else { await manufacturingService.createCollection(payload); toast.success('Colección creada'); }
      setModal(false); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (c: MfgCollection) => {
    if (!confirm(`¿Eliminar la colección "${c.name}"?`)) return;
    try { await manufacturingService.deleteCollection(c.id); toast.success('Eliminada'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg"><CalendarRange className="w-6 h-6 text-orange-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Colecciones</h1>
            <p className="text-sm text-gray-500">Año y semestre a los que pertenece cada referencia.</p>
          </div>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg">
          <Plus className="w-4 h-4" /> Nueva colección
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Año</th>
              <th className="px-4 py-3 font-medium">Semestre</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Sin colecciones. Crea la primera.</td></tr>
            ) : items.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-gray-600">{c.year || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{c.semester || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.isActive ? 'Activa' : 'Inactiva'}</span>
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editing ? 'Editar colección' : 'Nueva colección'}</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Nombre *</span>
                <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Verano 2026" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Año</span>
                  <input type="number" value={form.year ?? ''} onChange={(e) => setForm({ ...form, year: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="2026" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Semestre</span>
                  <select value={form.semester ?? ''} onChange={(e) => setForm({ ...form, semester: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                    <option value="">—</option><option value="I">I</option><option value="II">II</option>
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <span className="text-sm text-gray-700">Activa</span>
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
