import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Workflow } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgProcess, MfgInputType, MfgInput } from '../../types/manufacturing';

const empty = { name: '', code: '', sequence: 0, type: 'INTERNAL' as const, isActive: true };
interface ConsRow { kind: 'TYPE' | 'INPUT'; inputTypeId: number | ''; inputId: number | ''; }

export default function ProcessesPage() {
  const [items, setItems] = useState<MfgProcess[]>([]);
  const [inputTypes, setInputTypes] = useState<MfgInputType[]>([]);
  const [inputs, setInputs] = useState<MfgInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgProcess | null>(null);
  const [form, setForm] = useState<Partial<MfgProcess>>(empty);
  const [cons, setCons] = useState<ConsRow[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await manufacturingService.getProcesses());
    } catch {
      toast.error('No se pudieron cargar los procesos');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    manufacturingService.getInputTypes().then(setInputTypes).catch(() => {});
    manufacturingService.getInputs().then(setInputs).catch(() => {});
  }, []);

  const openNew = () => { setEditing(null); setForm({ ...empty, sequence: items.length + 1 }); setCons([]); setModal(true); };
  const openEdit = (p: MfgProcess) => {
    setEditing(p); setForm({ ...p });
    setCons((p.consumptions ?? []).map((c) => ({ kind: c.kind, inputTypeId: c.inputTypeId ?? '', inputId: c.inputId ?? '' })));
    setModal(true);
  };
  const addCons = () => setCons([...cons, { kind: 'TYPE', inputTypeId: '', inputId: '' }]);

  const save = async () => {
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    const consumptions = cons
      .filter((c) => (c.kind === 'TYPE' ? c.inputTypeId !== '' : c.inputId !== ''))
      .map((c) => ({ kind: c.kind, inputTypeId: c.kind === 'TYPE' ? Number(c.inputTypeId) : null, inputId: c.kind === 'INPUT' ? Number(c.inputId) : null }));
    setSaving(true);
    try {
      if (editing) {
        await manufacturingService.updateProcess(editing.id, { ...form, consumptions });
        toast.success('Proceso actualizado');
      } else {
        await manufacturingService.createProcess({ ...form, consumptions });
        toast.success('Proceso creado');
      }
      setModal(false);
      load();
    } catch {
      toast.error('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: MfgProcess) => {
    if (!confirm(`¿Eliminar el proceso "${p.name}"?`)) return;
    try {
      await manufacturingService.deleteProcess(p.id);
      toast.success('Proceso eliminado');
      load();
    } catch {
      toast.error('No se pudo eliminar');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg"><Workflow className="w-6 h-6 text-orange-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Procesos</h1>
            <p className="text-sm text-gray-500">Estaciones/etapas de producción. El orden define la ruta por defecto.</p>
          </div>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg">
          <Plus className="w-4 h-4" /> Nuevo proceso
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Orden</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sin procesos. Crea el primero.</td></tr>
            ) : items.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">{p.sequence}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                <td className="px-4 py-3 text-gray-600">{p.code || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.type === 'EXTERNAL' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {p.type === 'EXTERNAL' ? 'Externo' : 'Interno'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(p)} className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(p)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editing ? 'Editar proceso' : 'Nuevo proceso'}</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Nombre *</span>
                <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Corte, Confección…" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Código</span>
                  <input value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Orden</span>
                  <input type="number" value={form.sequence ?? 0} onChange={(e) => setForm({ ...form, sequence: Number(e.target.value) })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Tipo</span>
                <select value={form.type ?? 'INTERNAL'} onChange={(e) => setForm({ ...form, type: e.target.value as MfgProcess['type'] })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="INTERNAL">Interno</option>
                  <option value="EXTERNAL">Externo (satélite)</option>
                </select>
              </label>
              <div className="block">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">Consumo del proceso</span>
                  <button type="button" onClick={addCons} className="inline-flex items-center gap-1 text-xs text-orange-700 font-medium"><Plus className="w-3.5 h-3.5" /> Agregar</button>
                </div>
                <p className="text-xs text-gray-400 mb-2">Qué insumos consume: por tipo (categoría) o un insumo específico.</p>
                {cons.length === 0 ? <p className="text-xs text-gray-400">Sin consumo configurado.</p> : (
                  <div className="space-y-2">
                    {cons.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <select value={c.kind} onChange={(e) => setCons(cons.map((x, idx) => idx === i ? { ...x, kind: e.target.value as ConsRow['kind'] } : x))} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                          <option value="TYPE">Por tipo</option>
                          <option value="INPUT">Insumo</option>
                        </select>
                        {c.kind === 'TYPE' ? (
                          <select value={c.inputTypeId} onChange={(e) => setCons(cons.map((x, idx) => idx === i ? { ...x, inputTypeId: e.target.value === '' ? '' : Number(e.target.value) } : x))} className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                            <option value="">— Tipo de insumo —</option>
                            {inputTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        ) : (
                          <select value={c.inputId} onChange={(e) => setCons(cons.map((x, idx) => idx === i ? { ...x, inputId: e.target.value === '' ? '' : Number(e.target.value) } : x))} className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                            <option value="">— Insumo —</option>
                            {inputs.map((inp) => <option key={inp.id} value={inp.id}>{inp.code} · {inp.name}</option>)}
                          </select>
                        )}
                        <button type="button" onClick={() => setCons(cons.filter((_, idx) => idx !== i))} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
