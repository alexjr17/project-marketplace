import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgGarmentType, MfgSize } from '../../types/manufacturing';

const empty = { code: '', name: '', composition: 'SUPERIOR' as const, isActive: true };

const COMPOSITION_LABEL: Record<string, string> = { SUPERIOR: 'Superior', INFERIOR: 'Inferior', SET: 'Conjunto' };

export default function GarmentTypesPage() {
  const [items, setItems] = useState<MfgGarmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgGarmentType | null>(null);
  const [form, setForm] = useState<Partial<MfgGarmentType>>(empty);
  const [nationalIds, setNationalIds] = useState<number[]>([]);
  const [exportIds, setExportIds] = useState<number[]>([]);
  const [allSizes, setAllSizes] = useState<MfgSize[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getGarmentTypes()); }
    catch { toast.error('No se pudieron cargar los tipos de prenda'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); manufacturingService.getSizes().then(setAllSizes).catch(() => {}); }, []);

  const sortedSizes = [...allSizes].sort((a, b) => a.sortOrder - b.sortOrder);
  const toggle = (list: number[], set: (v: number[]) => void, id: number) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const openNew = () => { setEditing(null); setForm(empty); setNationalIds([]); setExportIds([]); setModal(true); };
  const openEdit = (g: MfgGarmentType) => {
    setEditing(g); setForm({ ...g });
    setNationalIds(g.sizes?.filter((s) => s.pivot?.market !== 'EXPORT').map((s) => s.id) ?? []);
    setExportIds(g.sizes?.filter((s) => s.pivot?.market === 'EXPORT').map((s) => s.id) ?? []);
    setModal(true);
  };

  const save = async () => {
    if (!form.code?.trim()) { toast.error('El código es obligatorio'); return; }
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    const payload = { ...form, nationalSizeIds: nationalIds, exportSizeIds: exportIds };
    setSaving(true);
    try {
      if (editing) { await manufacturingService.updateGarmentType(editing.id, payload); toast.success('Tipo de prenda actualizado'); }
      else { await manufacturingService.createGarmentType(payload); toast.success('Tipo de prenda creado'); }
      setModal(false); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (g: MfgGarmentType) => {
    if (!confirm(`¿Eliminar el tipo de prenda "${g.name}"?`)) return;
    try { await manufacturingService.deleteGarmentType(g.id); toast.success('Eliminado'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg"><Tag className="w-6 h-6 text-orange-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tipos de prenda</h1>
            <p className="text-sm text-gray-500">Su código prefija el de la referencia (ej. CAM → CAM-0001).</p>
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
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Composición</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Sin tipos de prenda. Crea el primero.</td></tr>
            ) : items.map((g) => (
              <tr key={g.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-semibold text-gray-800">{g.code}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{g.name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${g.composition === 'SET' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{COMPOSITION_LABEL[g.composition] ?? 'Superior'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${g.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{g.isActive ? 'Activo' : 'Inactivo'}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(g)} className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(g)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editing ? 'Editar tipo de prenda' : 'Nuevo tipo de prenda'}</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Código *</span>
                <input value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={10} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 font-mono uppercase" placeholder="CAM" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Nombre *</span>
                <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Camiseta" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Composición</span>
                <select value={form.composition ?? 'SUPERIOR'} onChange={(e) => setForm({ ...form, composition: e.target.value as MfgGarmentType['composition'] })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="SUPERIOR">Superior (individual)</option>
                  <option value="INFERIOR">Inferior (individual)</option>
                  <option value="SET">Conjunto (superior + inferior)</option>
                </select>
                <span className="text-xs text-gray-400">Define qué componentes lleva la referencia de este tipo.</span>
              </label>
              <div className="block">
                <span className="text-sm font-medium text-gray-700">Tallas del tipo</span>
                <p className="text-xs text-gray-400 mb-2">Se traen a la referencia según el mercado.</p>
                {sortedSizes.length === 0 ? <span className="text-sm text-gray-400">Crea tallas en Catálogos → Tallas.</span> : (
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Nacional</p>
                      <div className="flex flex-wrap gap-1.5">
                        {sortedSizes.filter((s) => s.market !== 'EXPORT').map((s) => (
                          <button key={s.id} type="button" onClick={() => toggle(nationalIds, setNationalIds, s.id)} className={`px-2.5 py-1 rounded-lg border text-sm font-medium ${nationalIds.includes(s.id) ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>{s.abbreviation}</button>
                        ))}
                        {sortedSizes.filter((s) => s.market !== 'EXPORT').length === 0 && <span className="text-xs text-gray-400">Sin tallas nacionales.</span>}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Exportación</p>
                      <div className="flex flex-wrap gap-1.5">
                        {sortedSizes.filter((s) => s.market === 'EXPORT').map((s) => (
                          <button key={s.id} type="button" onClick={() => toggle(exportIds, setExportIds, s.id)} className={`px-2.5 py-1 rounded-lg border text-sm font-medium ${exportIds.includes(s.id) ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>{s.abbreviation}</button>
                        ))}
                        {sortedSizes.filter((s) => s.market === 'EXPORT').length === 0 && <span className="text-xs text-gray-400">Sin tallas de exportación.</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Estado</span>
                <select value={(form.isActive ?? true) ? '1' : '0'} onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="1">Activo</option>
                  <option value="0">Inactivo</option>
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
