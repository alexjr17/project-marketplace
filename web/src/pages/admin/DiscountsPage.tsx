import { useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Plus, Search, Ticket, Trash2, X, Zap } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
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
import {
  Page, PageHeader, Button, IconButton, StatCard, FilterBar, SearchInput, Dialog, Field, FormGrid, TextInput,
  NumberInput, MoneyInput, SelectInput, RadioGroup, Switch, TableCard, Table, THead, TBody, Th, Tr, Td,
  Badge, EmptyState, Spinner, fieldClass, useConfirm,
} from '../../components/ui';

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

const fmtShort = (v?: string | null) => (v ? new Date(v).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : null);

/** Cupones con código y descuentos automáticos para la tienda y el POS. */
export default function DiscountsPage() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Discount | 'new' | null>(null);
  const [form, setForm] = useState<DiscountInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
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
    if (!(await confirm({ title: `¿Eliminar "${d.code || d.name || 'este descuento'}"?`, message: 'Los clientes ya no podrán usarlo. No se puede deshacer.', tone: 'danger' }))) return;
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

  const setMode = (auto: boolean) => {
    if (auto) {
      set('isAuto', true);
      if (form.appliesTo !== 'product' && form.appliesTo !== 'category') { set('appliesTo', 'product'); set('targetIds', []); setLabels({}); }
    } else {
      set('isAuto', false);
    }
  };

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((d) => [d.code, d.name].some((v) => v?.toLowerCase().includes(t))) : items;
  }, [items, q]);

  const stats = {
    total: items.length,
    active: items.filter((d) => d.isActive).length,
    auto: items.filter((d) => d.isAuto).length,
    uses: items.reduce((a, d) => a + (d.usedCount || 0), 0),
  };

  return (
    <Page>
      <PageHeader
        icon={Ticket}
        title="Cupones"
        subtitle="Cupones con código y descuentos automáticos para la tienda y el POS"
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>Nuevo cupón</Button>}
      />

      {loading ? <Spinner label="Cargando cupones…" /> : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState icon={Ticket} title="Aún no hay cupones" description="Crea un cupón con código o un descuento automático por producto o categoría."
            action={<Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>Nuevo cupón</Button>} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={Ticket} label="Cupones" value={stats.total} />
            <StatCard icon={Check} tone="green" label="Activos" value={stats.active} hint={`${stats.total - stats.active} inactivos`} />
            <StatCard icon={Zap} tone="blue" label="Automáticos" value={stats.auto} hint="Sin código" />
            <StatCard icon={Ticket} tone="gray" label="Usos totales" value={stats.uses.toLocaleString('es-CO')} />
          </div>

          <FilterBar>
            <div className="sm:col-span-2"><SearchInput value={q} onChange={setQ} placeholder="Buscar por código o nombre…" /></div>
          </FilterBar>

          <TableCard>
            <Table>
              <THead>
                <tr>
                  <Th>Código</Th><Th align="right">Descuento</Th><Th>Alcance</Th><Th>Canal</Th><Th>Vigencia</Th>
                  <Th align="right">Usos</Th><Th align="center">Activo</Th><Th align="right">Acciones</Th>
                </tr>
              </THead>
              <TBody>
                {rows.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Ningún cupón coincide con la búsqueda.</td></tr>
                ) : rows.map((d) => (
                  <Tr key={d.id}>
                    <Td>
                      {d.isAuto ? <Badge tone="blue"><Zap className="w-3 h-3" />Automático</Badge> : <span className="font-mono font-semibold text-gray-900">{d.code}</span>}
                      {d.name && <span className="block text-xs text-gray-500">{d.name}</span>}
                    </Td>
                    <Td align="right" className="font-semibold text-gray-900">{fmtValue(d)}</Td>
                    <Td>{APPLIES_LABELS[d.appliesTo] || d.appliesTo}{(d.targetIds?.length ?? 0) > 0 && <span className="text-gray-400"> · {d.targetIds!.length}</span>}</Td>
                    <Td>{CHANNEL_LABELS[d.channel] || d.channel}</Td>
                    <Td className="whitespace-nowrap text-gray-500">
                      {d.startsAt || d.endsAt ? `${fmtShort(d.startsAt) ?? 'Hoy'} – ${fmtShort(d.endsAt) ?? 'sin fin'}` : 'Siempre'}
                    </Td>
                    <Td align="right">{d.usedCount}{d.maxUses ? ` / ${d.maxUses}` : ''}</Td>
                    <Td align="center"><span className="inline-flex"><Switch checked={d.isActive} onChange={() => toggleActive(d)} /></span></Td>
                    <Td align="right" className="whitespace-nowrap">
                      <IconButton title="Editar" tone="app" onClick={() => openEdit(d)}><Pencil className="w-4 h-4" /></IconButton>
                      <IconButton title="Eliminar" tone="danger" onClick={() => remove(d)}><Trash2 className="w-4 h-4" /></IconButton>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableCard>
        </>
      )}

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        size="lg"
        title={editing === 'new' ? 'Nuevo cupón' : 'Editar cupón'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} isLoading={saving}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label="Tipo de cupón"
            hint={form.isAuto
              ? 'Se aplica solo al producto o categoría que elijas (sin que el cliente escriba nada) y se muestra el precio rebajado en toda la tienda.'
              : 'El cliente escribe el código al momento de pagar para canjearlo.'}
          >
            <RadioGroup<'code' | 'auto'>
              variant="segmented"
              value={form.isAuto ? 'auto' : 'code'}
              onChange={(v) => setMode(v === 'auto')}
              options={[{ value: 'code', label: 'Con código' }, { value: 'auto', label: 'Automático (sin código)' }]}
            />
          </Field>

          <FormGrid>
            {!form.isAuto && (
              <Field label="Código del cupón" required>
                <TextInput value={form.code || ''} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="BIENVENIDA10" className="font-mono uppercase" />
              </Field>
            )}
            <Field label="Nombre interno" hint="Opcional, solo lo ve el equipo.">
              <TextInput value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="Promo bienvenida" />
            </Field>
            <Field label="Tipo de descuento">
              <SelectInput value={form.type} onChange={(e) => set('type', e.target.value as DiscountInput['type'])}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </SelectInput>
            </Field>
            <Field label={form.type === 'percent' ? 'Porcentaje' : 'Monto'} required>
              {form.type === 'percent'
                ? <NumberInput min={0} suffix="%" value={form.value} onChange={(e) => set('value', Number(e.target.value))} />
                : <MoneyInput step="1" value={form.value} onChange={(e) => set('value', Number(e.target.value))} />}
            </Field>
            <Field label="Aplica a">
              <SelectInput value={form.appliesTo} onChange={(e) => { set('appliesTo', e.target.value as DiscountInput['appliesTo']); set('targetIds', []); setLabels({}); }}>
                {Object.entries(APPLIES_LABELS)
                  // Automático: solo Producto y Categoría. Con código: todas.
                  .filter(([k]) => !form.isAuto || k === 'product' || k === 'category')
                  .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </SelectInput>
            </Field>
            <Field label="Canal">
              <SelectInput value={form.channel} onChange={(e) => set('channel', e.target.value as DiscountInput['channel'])}>
                {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </SelectInput>
            </Field>
          </FormGrid>

          {form.appliesTo === 'category' && (
            <Field label="Categorías incluidas" required>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => {
                  const on = (form.targetIds ?? []).includes(c.id);
                  return (
                    <button key={c.id} type="button" onClick={() => toggleTarget(c.id)} aria-pressed={on}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${on ? 'bg-app-600 text-white border-app-600' : 'bg-white text-gray-600 border-gray-300 hover:border-app-400'}`}>
                      {on && <Check className="w-3 h-3" />}{c.name}
                    </button>
                  );
                })}
                {categories.length === 0 && <span className="text-xs text-gray-400">Sin categorías</span>}
              </div>
            </Field>
          )}

          {form.appliesTo === 'product' && (
            <Field label="Productos incluidos" required>
              <SearchPicker
                placeholder="Buscar producto…"
                selected={form.targetIds ?? []}
                labels={labels}
                onToggle={toggleTarget}
                search={async (term) => {
                  const list = await productsService.search(term, 8);
                  return list.map((p) => ({ id: Number(p.id), label: p.name }));
                }}
              />
            </Field>
          )}

          {form.appliesTo === 'user' && (
            <Field label="Usuarios habilitados" required>
              <SearchPicker
                placeholder="Buscar usuario por nombre o correo…"
                selected={form.targetIds ?? []}
                labels={labels}
                onToggle={toggleTarget}
                search={async (term) => {
                  const res = await usersService.getAll({ search: term, limit: 8 });
                  return res.data.map((u) => ({ id: u.id, label: `${u.name} (${u.email})` }));
                }}
              />
            </Field>
          )}

          <FormGrid cols={3}>
            <Field label="Compra mínima"><MoneyInput step="1" value={form.minSubtotal ?? ''} onChange={(e) => set('minSubtotal', e.target.value ? Number(e.target.value) : null)} placeholder="Sin mínimo" /></Field>
            <Field label="Usos máximos (total)"><NumberInput min={1} value={form.maxUses ?? ''} onChange={(e) => set('maxUses', e.target.value ? Number(e.target.value) : null)} placeholder="Ilimitado" /></Field>
            <Field label="Usos por usuario"><NumberInput min={1} value={form.maxUsesPerUser ?? ''} onChange={(e) => set('maxUsesPerUser', e.target.value ? Number(e.target.value) : null)} placeholder="Ilimitado" /></Field>
          </FormGrid>

          <FormGrid>
            <Field label="Desde" hint="Opcional"><TextInput type="datetime-local" value={toLocalInput(form.startsAt)} onChange={(e) => set('startsAt', e.target.value || null)} /></Field>
            <Field label="Hasta" hint="Opcional"><TextInput type="datetime-local" value={toLocalInput(form.endsAt)} onChange={(e) => set('endsAt', e.target.value || null)} /></Field>
          </FormGrid>

          <Switch checked={form.isActive} onChange={(v) => set('isActive', v)} label="Activo" description="Los cupones inactivos no se pueden usar." />
        </div>
      </Dialog>
    </Page>
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
            <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-app-50 text-app-700 text-xs font-medium">
              {labels[id] || `#${id}`}
              <button type="button" title="Quitar" onClick={() => onToggle(id)} className="hover:text-app-900"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input value={q} onChange={(e) => run(e.target.value)} placeholder={placeholder} className={`${fieldClass()} pl-9`} />
      </div>
      {busy && <p className="text-xs text-gray-400 mt-1">Buscando…</p>}
      {results.length > 0 && (
        <div className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-44 overflow-y-auto">
          {results.map((r) => {
            const on = selected.includes(r.id);
            return (
              <button key={r.id} type="button" onClick={() => onToggle(r.id, r.label)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${on ? 'text-app-700 font-medium' : 'text-gray-700'}`}>
                <span className="truncate">{r.label}</span>
                {on && <Check className="w-4 h-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
