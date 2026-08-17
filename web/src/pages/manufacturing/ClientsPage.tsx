import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgClient } from '../../types/manufacturing';

const empty = { name: '', documentId: '', documentType: '', businessName: '', email: '', phone: '', city: '', invoiceAddress: '', dispatchAddress: '', creditDays: null as number | null, isActive: true };

export default function ClientsPage() {
  const [items, setItems] = useState<MfgClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgClient | null>(null);
  const [form, setForm] = useState<Partial<MfgClient>>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getClients()); }
    catch { toast.error('No se pudieron cargar los clientes'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (c: MfgClient) => { setEditing(c); setForm({ ...c }); setModal(true); };

  const save = async () => {
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      if (editing) { await manufacturingService.updateClient(editing.id, form); toast.success('Cliente actualizado'); }
      else { await manufacturingService.createClient(form); toast.success('Cliente creado'); }
      setModal(false); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (c: MfgClient) => {
    if (!confirm(`¿Eliminar el cliente "${c.name}"?`)) return;
    try { await manufacturingService.deleteClient(c.id); toast.success('Cliente eliminado'); load(); }
    catch (e: any) { toast.error(e?.message || 'No se pudo eliminar'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg"><Users className="w-6 h-6 text-orange-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
            <p className="text-sm text-gray-500">Clientes a los que se les hacen los pedidos de producción.</p>
          </div>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg">
          <Plus className="w-4 h-4" /> Nuevo cliente
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Negocio</th>
              <th className="px-4 py-3 font-medium">Documento</th>
              <th className="px-4 py-3 font-medium">Ciudad</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sin clientes. Crea el primero.</td></tr>
            ) : items.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-gray-600">{c.businessName || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{c.documentId || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{c.city || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editing ? 'Editar cliente' : 'Nuevo cliente'}</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Nombre *</span>
                <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Nombre del negocio / razón social</span>
                <input value={form.businessName ?? ''} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Tipo doc.</span>
                  <select value={form.documentType ?? ''} onChange={(e) => setForm({ ...form, documentType: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                    <option value="">—</option>
                    <option value="C.C">C.C</option>
                    <option value="NIT">NIT</option>
                    <option value="Otro">Otro</option>
                  </select>
                </label>
                <label className="block col-span-2">
                  <span className="text-sm font-medium text-gray-700">Documento / NIT</span>
                  <input value={form.documentId ?? ''} onChange={(e) => setForm({ ...form, documentId: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Email</span>
                  <input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Teléfono</span>
                  <input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Ciudad</span>
                  <input value={form.city ?? ''} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Plazo crédito (días)</span>
                  <input type="number" min="0" value={form.creditDays ?? ''} onChange={(e) => setForm({ ...form, creditDays: e.target.value === '' ? null : Number(e.target.value) })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Dirección de facturación</span>
                <input value={form.invoiceAddress ?? ''} onChange={(e) => setForm({ ...form, invoiceAddress: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Dirección de despacho</span>
                <input value={form.dispatchAddress ?? ''} onChange={(e) => setForm({ ...form, dispatchAddress: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
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
    </div>
  );
}
