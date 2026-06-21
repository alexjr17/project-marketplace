import { useEffect, useState } from 'react';
import { Megaphone, Plus, Pencil, Trash2, Loader2, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/shared/Button';
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type Announcement,
  type AnnouncementInput,
} from '../../services/announcements.service';

const TYPE_LABELS: Record<string, string> = {
  bar: 'Barra (alert)',
  popup: 'Popup',
  marquee: 'Marquesina',
  floating: 'Flotante',
};
const VARIANT_LABELS: Record<string, string> = {
  info: 'Info (azul)', promo: 'Promo (degradado)', warning: 'Alerta (ámbar)', success: 'Éxito (verde)', dark: 'Oscuro',
};

const EMPTY: AnnouncementInput = {
  type: 'bar',
  layout: 'standard',
  size: 'md',
  title: '',
  message: '',
  imageUrl: '',
  ctaText: '',
  ctaUrl: '',
  couponCode: '',
  variant: 'promo',
  bgColor: '',
  textColor: '',
  isActive: true,
  dismissible: true,
  target: 'all',
  frequency: 'always',
  priority: 0,
  startsAt: null,
  endsAt: null,
};

function toLocalInput(v?: string | null) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AnnouncementsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Announcement | 'new' | null>(null);
  const [form, setForm] = useState<AnnouncementInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    listAnnouncements().then(setItems).catch(() => showToast('Error al cargar anuncios', 'error')).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => { setForm(EMPTY); setEditing('new'); };
  const openEdit = (a: Announcement) => {
    setForm({ ...EMPTY, ...a, startsAt: a.startsAt ?? null, endsAt: a.endsAt ?? null });
    setEditing(a);
  };

  const set = <K extends keyof AnnouncementInput>(k: K, v: AnnouncementInput[K]) => setForm((p) => ({ ...p, [k]: v }));

  const onImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => set('imageUrl', String(reader.result || ''));
    reader.readAsDataURL(f);
  };

  const save = async () => {
    if (!form.title && !form.message && !form.imageUrl) {
      showToast('Agrega al menos un título, mensaje o imagen', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: AnnouncementInput = {
        ...form,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        priority: Number(form.priority) || 0,
      };
      if (editing === 'new') await createAnnouncement(payload);
      else if (editing) await updateAnnouncement(editing.id, payload);
      showToast('Anuncio guardado', 'success');
      setEditing(null);
      load();
    } catch {
      showToast('No se pudo guardar el anuncio', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Announcement) => {
    if (!window.confirm('¿Eliminar este anuncio?')) return;
    try {
      await deleteAnnouncement(a.id);
      showToast('Anuncio eliminado', 'success');
      load();
    } catch {
      showToast('No se pudo eliminar', 'error');
    }
  };

  const toggleActive = async (a: Announcement) => {
    try {
      await updateAnnouncement(a.id, { ...a, isActive: !a.isActive });
      load();
    } catch {
      showToast('No se pudo actualizar', 'error');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-pink-100 rounded-xl"><Megaphone className="w-7 h-7 text-pink-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Publicidad / Anuncios</h1>
            <p className="text-gray-600 text-sm mt-0.5">Barras, popups, marquesinas y tarjetas flotantes en la tienda</p>
          </div>
        </div>
        <Button variant="admin-primary" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nuevo anuncio</Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16 text-gray-400"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Megaphone className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            Aún no hay anuncios. Crea el primero con “Nuevo anuncio”.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Título / Mensaje</th>
                <th className="px-4 py-3 text-left">Dónde</th>
                <th className="px-4 py-3 text-center">Activo</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">{TYPE_LABELS[a.type] || a.type}</span></td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 truncate max-w-xs">{a.title || '—'}</p>
                    <p className="text-gray-500 truncate max-w-xs">{a.message}</p>
                    {a.couponCode && <span className="text-xs text-pink-600 font-semibold">Cupón: {a.couponCode}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{a.target}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(a)} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {a.isActive ? 'Sí' : 'No'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(a)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => remove(a)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Formulario */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{editing === 'new' ? 'Nuevo anuncio' : 'Editar anuncio'}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo">
                  <select value={form.type} onChange={(e) => set('type', e.target.value as AnnouncementInput['type'])} className="sel">
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="Estilo (preset)">
                  <select value={form.variant} onChange={(e) => set('variant', e.target.value as AnnouncementInput['variant'])} className="sel">
                    {Object.entries(VARIANT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Color propio (opcional — vacío usa el preset/marca)">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    Fondo
                    <input type="color" value={form.bgColor || '#7c3aed'} onChange={(e) => set('bgColor', e.target.value)} className="w-9 h-8 rounded border cursor-pointer" />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    Texto
                    <input type="color" value={form.textColor || '#ffffff'} onChange={(e) => set('textColor', e.target.value)} className="w-9 h-8 rounded border cursor-pointer" />
                  </label>
                  {(form.bgColor || form.textColor) && (
                    <button type="button" onClick={() => { set('bgColor', ''); set('textColor', ''); }} className="text-xs text-gray-500 hover:text-red-600 underline">
                      Quitar (usar marca)
                    </button>
                  )}
                </div>
              </Field>

              <Field label="Título">
                <input value={form.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="Ej: ¡Envío gratis hoy!" className="inp" />
              </Field>
              <Field label="Mensaje">
                <textarea value={form.message || ''} onChange={(e) => set('message', e.target.value)} rows={2} placeholder="Texto del anuncio" className="inp" />
              </Field>

              {form.type === 'popup' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Diseño del popup">
                    <select value={form.layout || 'standard'} onChange={(e) => set('layout', e.target.value as AnnouncementInput['layout'])} className="sel">
                      <option value="standard">Estándar (imagen + texto)</option>
                      <option value="image">Solo imagen (botón encima)</option>
                      <option value="overlay">Imagen con texto encima</option>
                    </select>
                  </Field>
                  <Field label="Tamaño del modal">
                    <select value={form.size || 'md'} onChange={(e) => set('size', e.target.value as AnnouncementInput['size'])} className="sel">
                      <option value="sm">Pequeño</option>
                      <option value="md">Mediano</option>
                      <option value="lg">Grande</option>
                      <option value="xl">Extra grande</option>
                    </select>
                  </Field>
                </div>
              )}

              {(form.type === 'popup' || form.type === 'floating') && (
                <Field label="Imagen (popup/flotante)">
                  <div className="flex items-center gap-2">
                    <input type="file" accept="image/*" onChange={onImage} className="text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700" />
                    {form.imageUrl && <img src={form.imageUrl} alt="" className="w-10 h-10 object-cover rounded border" />}
                  </div>
                </Field>
              )}

              <div className="grid grid-cols-3 gap-3">
                <Field label="Texto del botón"><input value={form.ctaText || ''} onChange={(e) => set('ctaText', e.target.value)} placeholder="Ver ofertas" className="inp" /></Field>
                <Field label="Enlace del botón"><input value={form.ctaUrl || ''} onChange={(e) => set('ctaUrl', e.target.value)} placeholder="/catalog o https://" className="inp" /></Field>
                <Field label="Cupón (opcional)"><input value={form.couponCode || ''} onChange={(e) => set('couponCode', e.target.value)} placeholder="BIENVENIDA10" className="inp" /></Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Dónde mostrar">
                  <select value={form.target} onChange={(e) => set('target', e.target.value as AnnouncementInput['target'])} className="sel">
                    <option value="all">Toda la web</option>
                    <option value="home">Solo inicio</option>
                    <option value="catalog">Solo catálogo</option>
                  </select>
                </Field>
                <Field label="Frecuencia">
                  <select value={form.frequency} onChange={(e) => set('frequency', e.target.value as AnnouncementInput['frequency'])} className="sel">
                    <option value="always">Siempre</option>
                    <option value="session">1 vez por sesión</option>
                    <option value="daily">1 vez por día</option>
                  </select>
                </Field>
                <Field label="Prioridad"><input type="number" value={form.priority} onChange={(e) => set('priority', Number(e.target.value))} className="inp" /></Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Desde (opcional)"><input type="datetime-local" value={toLocalInput(form.startsAt)} onChange={(e) => set('startsAt', e.target.value || null)} className="inp" /></Field>
                <Field label="Hasta (opcional)"><input type="datetime-local" value={toLocalInput(form.endsAt)} onChange={(e) => set('endsAt', e.target.value || null)} className="inp" /></Field>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Activo</label>
                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.dismissible} onChange={(e) => set('dismissible', e.target.checked)} /> Se puede cerrar (✕)</label>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-3">
              <Button variant="admin-secondary" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
              <Button variant="admin-primary" onClick={save} isLoading={saving}>Guardar</Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .inp { width:100%; padding:.5rem .75rem; border:1px solid #d1d5db; border-radius:.5rem; font-size:.875rem; }
        .sel { width:100%; padding:.5rem .5rem; border:1px solid #d1d5db; border-radius:.5rem; font-size:.875rem; background:#fff; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
