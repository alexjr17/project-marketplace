import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Ruler } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgSize } from '../../types/manufacturing';

const empty = { name: '', abbreviation: '', market: 'NATIONAL' as const, sortOrder: 0, isActive: true };

const MARKET_LABEL: Record<string, string> = { NATIONAL: 'Nacional', EXPORT: 'Exportación' };

export default function MfgSizesPage() {
  const [items, setItems] = useState<MfgSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgSize | null>(null);
  const [form, setForm] = useState<Partial<MfgSize>>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getSizes()); }
    catch { toast.error('No se pudieron cargar las tallas'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ ...empty, sortOrder: items.length + 1 }); setModal(true); };
  const openEdit = (s: MfgSize) => { setEditing(s); setForm({ ...s }); setModal(true); };

  const save = async () => {
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    if (!form.abbreviation?.trim()) { toast.error('La abreviatura es obligatoria'); return; }
    setSaving(true);
    try {
      if (editing) { await manufacturingService.updateSize(editing.id, form); toast.success('Talla actualizada'); }
      else { await manufacturingService.createSize(form); toast.success('Talla creada'); }
      setModal(false); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (s: MfgSize) => {
    if (!confirm(`¿Eliminar la talla "${s.name}"?`)) return;
    try { await manufacturingService.deleteSize(s.id); toast.success('Eliminada'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg"><Ruler className="w-6 h-6 text-orange-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tallas</h1>
            <p className="text-sm text-gray-500">Tallas propias de Fábrica.</p>
          </div>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg">
          <Plus className="w-4 h-4" /> Nueva talla
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Orden</th>
              <th className="px-4 py-3 font-medium">Abrev.</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Mercado</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sin tallas. Crea la primera.</td></tr>
            ) : items.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">{s.sortOrder}</td>
                <td className="px-4 py-3 font-semibold text-gray-800">{s.abbreviation}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.market === 'EXPORT' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{MARKET_LABEL[s.market] ?? 'Nacional'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{s.isActive ? 'Activa' : 'Inactiva'}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(s)} className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(s)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editing ? 'Editar talla' : 'Nueva talla'}</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Abreviatura *</span>
                  <input value={form.abbreviation ?? ''} onChange={(e) => setForm({ ...form, abbreviation: e.target.value })} maxLength={10} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="M" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Orden</span>
                  <input type="number" value={form.sortOrder ?? 0} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Nombre *</span>
                <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Medium" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Mercado</span>
                <select value={form.market ?? 'NATIONAL'} onChange={(e) => setForm({ ...form, market: e.target.value as MfgSize['market'] })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="NATIONAL">Nacional</option>
                  <option value="EXPORT">Exportación</option>
                </select>
              </label>
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
