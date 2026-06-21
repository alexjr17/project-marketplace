import { useEffect, useState } from 'react';
import { Ticket, Plus, Pencil, Trash2, Loader2, X, Search } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/shared/Button';
import {
  listDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  type Discount,
  type DiscountInput,
} from '../../services/discounts.service';
import { productsService } from '../../services/products.service';
import { usersService } from '../../services/users.service';

const TYPE_LABELS: Record<string, string> = {
  percent: 'Porcentaje (%)',
  fixed: 'Monto fijo ($)',
};
const APPLIES_LABELS: Record<string, string> = {
  all: 'Todo el pedido',
  product: 'Producto(s)',
  category: 'Categoría(s)',
  user: 'Usuario(s)',
};
const CHANNEL_LABELS: Record<string, string> = {
  all: 'Tienda y POS',
  online: 'Solo tienda',
  pos: 'Solo POS',
};

const EMPTY: DiscountInput = {
  isAuto: false,
  code: '',
  name: '',
  type: 'percent',
  value: 10,
  appliesTo: 'all',
  targetIds: [],
  channel: 'all',
  minSubtotal: null,
  maxUses: null,
  maxUsesPerUser: null,
  isActive: true,
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

const fmtValue = (d: Discount | DiscountInput) =>
  d.type === 'percent' ? `${d.value}%` : `$${Number(d.value).toLocaleString('es-CO')}`;

export default function DiscountsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Discount | 'new' | null>(null);
  const [form, setForm] = useState<DiscountInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  // Etiquetas id -> nombre para mostrar los chips de producto/usuario seleccionados.
  const [labels, setLabels] = useState<Record<number, string>>({});

  const load = () => {
    setLoading(true);
    listDiscounts().then(setItems).catch(() => showToast('Error al cargar cupones', 'error')).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    productsService.getCategories().then((c) => setCategories(c.map((x) => ({ id: x.id, name: x.name })))).catch(() => {});
  }, []);

  const openNew = () => { setForm(EMPTY); setLabels({}); setEditing('new'); };
  const openEdit = async (d: Discount) => {
    setForm({ ...EMPTY, ...d, targetIds: d.targetIds ?? [] });
    setEditing(d);
    // Resolver nombres de los targets para los chips.
    const ids = d.targetIds ?? [];
    if (d.appliesTo === 'product' && ids.length) {
      const map: Record<number, string> = {};
      await Promise.all(ids.map(async (id) => {
        const p = await productsService.getById(id);
        if (p) map[id] = p.name;
      }));
      setLabels(map);
    } else if (d.appliesTo === 'user' && ids.length) {
      const map: Record<number, string> = {};
      await Promise.all(ids.map(async (id) => {
        const u = await usersService.getById(id);
        if (u) map[id] = `${u.name} (${u.email})`;
      }));
      setLabels(map);
    } else {
      setLabels({});
    }
  };

  const set = <K extends keyof DiscountInput>(k: K, v: DiscountInput[K]) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.isAuto && !(form.code ?? '').trim()) { showToast('El código es obligatorio', 'error'); return; }
    if (!(Number(form.value) > 0)) { showToast('El valor debe ser mayor a 0', 'error'); return; }
    if (form.appliesTo !== 'all' && (form.targetIds ?? []).length === 0) {
      showToast('Selecciona al menos un objetivo para el alcance elegido', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: DiscountInput = {
        ...form,
        code: form.isAuto ? null : ((form.code ?? '').trim().toUpperCase() || null),
        value: Number(form.value) || 0,
        minSubtotal: form.minSubtotal ? Number(form.minSubtotal) : null,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        maxUsesPerUser: form.maxUsesPerUser ? Number(form.maxUsesPerUser) : null,
        targetIds: form.appliesTo === 'all' ? [] : (form.targetIds ?? []),
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
      };
      if (editing === 'new') await createDiscount(payload);
      else if (editing) await updateDiscount(editing.id, payload);
      showToast('Cupón guardado', 'success');
      setEditing(null);
      load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo guardar el cupón';
      showToast(msg.includes('code') ? 'Ya existe un cupón con ese código' : 'No se pudo guardar el cupón', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (d: Discount) => {
    if (!window.confirm(`¿Eliminar "${d.code || d.name || 'este descuento'}"?`)) return;
    try {
      await deleteDiscount(d.id);
      showToast('Cupón eliminado', 'success');
      load();
    } catch {
      showToast('No se pudo eliminar', 'error');
    }
  };

  const toggleActive = async (d: Discount) => {
    try {
      await updateDiscount(d.id, { ...d, isActive: !d.isActive, targetIds: d.targetIds ?? [] });
      load();
    } catch {
      showToast('No se pudo actualizar', 'error');
    }
  };

  // Añadir / quitar un id de targetIds.
  const toggleTarget = (id: number, label?: string) => {
    const cur = form.targetIds ?? [];
    if (cur.includes(id)) {
      set('targetIds', cur.filter((x) => x !== id));
    } else {
      set('targetIds', [...cur, id]);
      if (label) setLabels((m) => ({ ...m, [id]: label }));
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 rounded-xl"><Ticket className="w-7 h-7 text-emerald-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cupones / Descuentos</h1>
            <p className="text-gray-600 text-sm mt-0.5">Cupones por producto, categoría o usuario, para tienda y/o POS</p>
          </div>
        </div>
        <Button variant="admin-primary" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nuevo cupón</Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16 text-gray-400"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Ticket className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            Aún no hay cupones. Crea el primero con “Nuevo cupón”.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">Descuento</th>
                <th className="px-4 py-3 text-left">Alcance</th>
                <th className="px-4 py-3 text-left">Canal</th>
                <th className="px-4 py-3 text-center">Usos</th>
                <th className="px-4 py-3 text-center">Activo</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {d.isAuto ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">Automático</span>
                    ) : (
                      <span className="font-mono font-bold text-emerald-700">{d.code}</span>
                    )}
                    {d.name && <p className="text-xs text-gray-500">{d.name}</p>}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{fmtValue(d)}</td>
                  <td className="px-4 py-3 text-gray-600">{APPLIES_LABELS[d.appliesTo] || d.appliesTo}</td>
                  <td className="px-4 py-3 text-gray-600">{CHANNEL_LABELS[d.channel] || d.channel}</td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {d.usedCount}{d.maxUses ? ` / ${d.maxUses}` : ''}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(d)} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${d.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {d.isActive ? 'Sí' : 'No'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(d)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => remove(d)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
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
              <h2 className="text-lg font-semibold text-gray-900">{editing === 'new' ? 'Nuevo cupón' : 'Editar cupón'}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto">
              {/* Modo: automático (sin código) o con código (canjeable al pagar) */}
              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => { set('isAuto', true); if (form.appliesTo !== 'product' && form.appliesTo !== 'category') { set('appliesTo', 'product'); set('targetIds', []); setLabels({}); } }}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-semibold transition-colors ${form.isAuto ? 'bg-white shadow text-emerald-700' : 'text-gray-500'}`}
                >
                  Automático (sin código)
                </button>
                <button
                  type="button"
                  onClick={() => set('isAuto', false)}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-semibold transition-colors ${!form.isAuto ? 'bg-white shadow text-emerald-700' : 'text-gray-500'}`}
                >
                  Con código
                </button>
              </div>
              <p className="text-xs text-gray-500 -mt-1">
                {form.isAuto
                  ? 'Se aplica solo al producto o categoría que elijas (sin que el cliente escriba nada) y se muestra el precio rebajado en toda la tienda.'
                  : 'El cliente escribe el código al momento de pagar para canjearlo.'}
              </p>

              <div className="grid grid-cols-2 gap-3">
                {!form.isAuto && (
                  <Field label="Código del cupón">
                    <input value={form.code || ''} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="BIENVENIDA10" className="inp font-mono uppercase" />
                  </Field>
                )}
                <Field label="Nombre interno (opcional)">
                  <input value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="Promo bienvenida" className="inp" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo de descuento">
                  <select value={form.type} onChange={(e) => set('type', e.target.value as DiscountInput['type'])} className="sel">
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label={form.type === 'percent' ? 'Porcentaje (%)' : 'Monto ($)'}>
                  <input type="number" min={0} value={form.value} onChange={(e) => set('value', Number(e.target.value))} className="inp" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Aplica a">
                  <select value={form.appliesTo} onChange={(e) => { set('appliesTo', e.target.value as DiscountInput['appliesTo']); set('targetIds', []); setLabels({}); }} className="sel">
                    {Object.entries(APPLIES_LABELS)
                      // Automático: solo Producto y Categoría. Con código: todas.
                      .filter(([k]) => !form.isAuto || k === 'product' || k === 'category')
                      .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="Canal">
                  <select value={form.channel} onChange={(e) => set('channel', e.target.value as DiscountInput['channel'])} className="sel">
                    {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
              </div>

              {/* Selector de objetivos según el alcance */}
              {form.appliesTo === 'category' && (
                <Field label="Categorías incluidas">
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => {
                      const on = (form.targetIds ?? []).includes(c.id);
                      return (
                        <button key={c.id} type="button" onClick={() => toggleTarget(c.id)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'}`}>
                          {c.name}
                        </button>
                      );
                    })}
                    {categories.length === 0 && <span className="text-xs text-gray-400">Sin categorías</span>}
                  </div>
                </Field>
              )}

              {form.appliesTo === 'product' && (
                <Field label="Productos incluidos">
                  <SearchPicker
                    placeholder="Buscar producto…"
                    selected={form.targetIds ?? []}
                    labels={labels}
                    onToggle={toggleTarget}
                    search={async (q) => {
                      const list = await productsService.search(q, 8);
                      return list.map((p) => ({ id: Number(p.id), label: p.name }));
                    }}
                  />
                </Field>
              )}

              {form.appliesTo === 'user' && (
                <Field label="Usuarios habilitados">
                  <SearchPicker
                    placeholder="Buscar usuario por nombre o correo…"
                    selected={form.targetIds ?? []}
                    labels={labels}
                    onToggle={toggleTarget}
                    search={async (q) => {
                      const res = await usersService.getAll({ search: q, limit: 8 });
                      return res.data.map((u) => ({ id: u.id, label: `${u.name} (${u.email})` }));
                    }}
                  />
                </Field>
              )}

              <div className="grid grid-cols-3 gap-3">
                <Field label="Mínimo de compra ($)"><input type="number" min={0} value={form.minSubtotal ?? ''} onChange={(e) => set('minSubtotal', e.target.value ? Number(e.target.value) : null)} placeholder="—" className="inp" /></Field>
                <Field label="Usos máximos (total)"><input type="number" min={1} value={form.maxUses ?? ''} onChange={(e) => set('maxUses', e.target.value ? Number(e.target.value) : null)} placeholder="∞" className="inp" /></Field>
                <Field label="Usos por usuario"><input type="number" min={1} value={form.maxUsesPerUser ?? ''} onChange={(e) => set('maxUsesPerUser', e.target.value ? Number(e.target.value) : null)} placeholder="∞" className="inp" /></Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Desde (opcional)"><input type="datetime-local" value={toLocalInput(form.startsAt)} onChange={(e) => set('startsAt', e.target.value || null)} className="inp" /></Field>
                <Field label="Hasta (opcional)"><input type="datetime-local" value={toLocalInput(form.endsAt)} onChange={(e) => set('endsAt', e.target.value || null)} className="inp" /></Field>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Activo</label>
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

/** Buscador con chips para seleccionar productos/usuarios por id. */
function SearchPicker({
  placeholder, selected, labels, onToggle, search,
}: {
  placeholder: string;
  selected: number[];
  labels: Record<number, string>;
  onToggle: (id: number, label?: string) => void;
  search: (q: string) => Promise<Array<{ id: number; label: string }>>;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ id: number; label: string }>>([]);
  const [busy, setBusy] = useState(false);

  const run = async (value: string) => {
    setQ(value);
    if (value.trim().length < 1) { setResults([]); return; }
    setBusy(true);
    try {
      setResults(await search(value.trim()));
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
              {labels[id] || `#${id}`}
              <button type="button" onClick={() => onToggle(id)} className="hover:text-emerald-900"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={(e) => run(e.target.value)} placeholder={placeholder} className="inp pl-8" />
      </div>
      {busy && <p className="text-xs text-gray-400 mt-1">Buscando…</p>}
      {results.length > 0 && (
        <div className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-44 overflow-y-auto">
          {results.map((r) => {
            const on = selected.includes(r.id);
            return (
              <button key={r.id} type="button" onClick={() => onToggle(r.id, r.label)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${on ? 'text-emerald-700 font-medium' : 'text-gray-700'}`}>
                <span className="truncate">{r.label}</span>
                {on && <span className="text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
