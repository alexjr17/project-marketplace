import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import MultiSelect from '../../components/manufacturing/MultiSelect';
import type { MfgWorkshop, MfgProcess } from '../../types/manufacturing';

const empty = { name: '', code: '', type: 'EXTERNAL' as const, contactName: '', phone: '', notes: '', isActive: true };

export default function WorkshopsPage() {
  const [items, setItems] = useState<MfgWorkshop[]>([]);
  const [allProcesses, setAllProcesses] = useState<MfgProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgWorkshop | null>(null);
  const [form, setForm] = useState<Partial<MfgWorkshop>>(empty);
  const [processIds, setProcessIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getWorkshops()); }
    catch { toast.error('No se pudieron cargar los talleres'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); manufacturingService.getProcesses().then(setAllProcesses).catch(() => {}); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setProcessIds([]); setModal(true); };
  const openEdit = (w: MfgWorkshop) => { setEditing(w); setForm({ ...w }); setProcessIds(w.processes?.map((p) => p.id) ?? []); setModal(true); };

  const save = async () => {
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    const payload = { ...form, processIds };
    setSaving(true);
    try {
      if (editing) { await manufacturingService.updateWorkshop(editing.id, payload); toast.success('Taller actualizado'); }
      else { await manufacturingService.createWorkshop(payload); toast.success('Taller creado'); }
      setModal(false); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (w: MfgWorkshop) => {
    if (!confirm(`¿Eliminar el taller "${w.name}"?`)) return;
    try { await manufacturingService.deleteWorkshop(w.id); toast.success('Taller eliminado'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg"><Building2 className="w-6 h-6 text-orange-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Talleres</h1>
            <p className="text-sm text-gray-500">Talleres internos y satélites (producción tercerizada).</p>
          </div>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg">
          <Plus className="w-4 h-4" /> Nuevo taller
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Procesos</th>
              <th className="px-4 py-3 font-medium">Contacto</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Sin talleres. Crea el primero.</td></tr>
            ) : items.map((w) => (
              <tr key={w.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{w.name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${w.type === 'EXTERNAL' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {w.type === 'EXTERNAL' ? 'Satélite' : 'Interno'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {w.processes && w.processes.length > 0 ? w.processes.map((p) => <span key={p.id} className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">{p.name}</span>) : <span className="text-gray-400">—</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{w.contactName || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{w.phone || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${w.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {w.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(w)} className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(w)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editing ? 'Editar taller' : 'Nuevo taller'}</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Nombre *</span>
                <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Código</span>
                  <input value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Tipo</span>
                  <select value={form.type ?? 'EXTERNAL'} onChange={(e) => setForm({ ...form, type: e.target.value as MfgWorkshop['type'] })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                    <option value="EXTERNAL">Satélite (externo)</option>
                    <option value="INTERNAL">Interno</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Contacto</span>
                  <input value={form.contactName ?? ''} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Teléfono</span>
                  <input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
              </div>
              <div className="block">
                <span className="text-sm font-medium text-gray-700">Procesos que hace</span>
                <p className="text-xs text-gray-400 mb-1">El taller aparecerá al asignar estos procesos en una orden.</p>
                <MultiSelect placeholder="Buscar procesos…" value={processIds} onChange={setProcessIds}
                  options={allProcesses.map((p) => ({ id: p.id, label: p.name }))} />
              </div>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Notas</span>
                <textarea value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
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
