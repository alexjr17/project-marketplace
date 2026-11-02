import { useEffect, useState } from 'react';
import { Eye, Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type Announcement,
  type AnnouncementInput,
} from '../../services/announcements.service';
import {
  Page, PageHeader, Button, IconButton, StatCard, Dialog, Field, FormGrid, TextInput, TextArea, NumberInput,
  SelectInput, ColorInput, Switch, ImageInput, Alert, TableCard, Table, THead, TBody, Th, Tr, Td, Badge,
  EmptyState, Spinner, Thumb, useConfirm,
} from '../../components/ui';

const TYPE_LABELS: Record<string, string> = {
  bar: 'Barra (alert)',
  popup: 'Popup',
  marquee: 'Marquesina',
  floating: 'Flotante',
  countdown: 'Cuenta regresiva',
  toast: 'Notificación',
};
const VARIANT_LABELS: Record<string, string> = {
  info: 'Info (azul)', promo: 'Promo (degradado)', warning: 'Alerta (ámbar)', success: 'Éxito (verde)', dark: 'Oscuro',
};
const TARGET_LABELS: Record<string, string> = { all: 'Toda la web', home: 'Solo inicio', catalog: 'Solo catálogo' };
const FREQ_LABELS: Record<string, string> = { always: 'Siempre', session: '1 vez por sesión', daily: '1 vez por día' };

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

/** Anuncios de la tienda: barras, popups, marquesinas, flotantes, cuentas regresivas y notificaciones. */
export default function AnnouncementsPage() {
  const { showToast } = useToast();
  const confirm = useConfirm();
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
    if (!(await confirm({ title: '¿Eliminar este anuncio?', message: a.title ? `"${a.title}" dejará de mostrarse en la tienda.` : 'Dejará de mostrarse en la tienda.', tone: 'danger' }))) return;
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

  const active = items.filter((a) => a.isActive).length;
  const withImage = ['popup', 'floating', 'toast'].includes(form.type);

  return (
    <Page>
      <PageHeader
        icon={Megaphone}
        title="Anuncios"
        subtitle="Barras, popups, marquesinas y tarjetas flotantes en la tienda"
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>Nuevo anuncio</Button>}
      />

      {loading ? <Spinner label="Cargando anuncios…" /> : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState icon={Megaphone} title="Aún no hay anuncios" description="Crea una barra, un popup o una cuenta regresiva para destacar promociones en la tienda."
            action={<Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>Nuevo anuncio</Button>} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={Megaphone} label="Anuncios" value={items.length} />
            <StatCard icon={Eye} tone="green" label="Activos" value={active} hint={`${items.length - active} inactivos`} />
          </div>

          <TableCard>
            <Table>
              <THead>
                <tr><Th>Anuncio</Th><Th>Tipo</Th><Th>Dónde</Th><Th align="right">Prioridad</Th><Th align="center">Activo</Th><Th align="right">Acciones</Th></tr>
              </THead>
              <TBody>
                {items.map((a) => (
                  <Tr key={a.id}>
                    <Td>
                      <span className="flex items-center gap-3">
                        {a.imageUrl && <Thumb src={a.imageUrl} size="sm" />}
                        <span className="min-w-0">
                          <span className="block font-medium text-gray-900 truncate max-w-xs">{a.title || '—'}</span>
                          {a.message && <span className="block text-gray-500 truncate max-w-xs">{a.message}</span>}
                          {a.couponCode && <span className="block text-xs text-gray-500">Cupón: <span className="font-mono font-semibold text-gray-700">{a.couponCode}</span></span>}
                        </span>
                      </span>
                    </Td>
                    <Td><Badge tone="gray">{TYPE_LABELS[a.type] || a.type}</Badge></Td>
                    <Td>{TARGET_LABELS[a.target] || a.target}<span className="block text-xs text-gray-500">{FREQ_LABELS[a.frequency] || a.frequency}</span></Td>
                    <Td align="right">{a.priority ?? 0}</Td>
                    <Td align="center"><span className="inline-flex"><Switch checked={a.isActive} onChange={() => toggleActive(a)} /></span></Td>
                    <Td align="right" className="whitespace-nowrap">
                      <IconButton title="Editar" tone="app" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></IconButton>
                      <IconButton title="Eliminar" tone="danger" onClick={() => remove(a)}><Trash2 className="w-4 h-4" /></IconButton>
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
        title={editing === 'new' ? 'Nuevo anuncio' : 'Editar anuncio'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} isLoading={saving}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormGrid>
            <Field label="Tipo">
              <SelectInput value={form.type} onChange={(e) => set('type', e.target.value as AnnouncementInput['type'])}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </SelectInput>
            </Field>
            <Field label="Estilo">
              <SelectInput value={form.variant} onChange={(e) => set('variant', e.target.value as AnnouncementInput['variant'])}>
                {Object.entries(VARIANT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </SelectInput>
            </Field>
          </FormGrid>

          <Field label="Título">
            <TextInput value={form.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="Ej: ¡Envío gratis hoy!" />
          </Field>
          <Field label="Mensaje">
            <TextArea value={form.message || ''} onChange={(e) => set('message', e.target.value)} rows={2} placeholder="Texto del anuncio" />
          </Field>

          {form.type === 'popup' && (
            <FormGrid>
              <Field label="Diseño del popup">
                <SelectInput value={form.layout || 'standard'} onChange={(e) => set('layout', e.target.value as AnnouncementInput['layout'])}>
                  <option value="standard">Estándar (imagen + texto)</option>
                  <option value="image">Solo imagen (botón encima)</option>
                  <option value="overlay">Imagen con texto encima</option>
                </SelectInput>
              </Field>
              <Field label="Tamaño del modal">
                <SelectInput value={form.size || 'md'} onChange={(e) => set('size', e.target.value as AnnouncementInput['size'])}>
                  <option value="sm">Pequeño</option>
                  <option value="md">Mediano</option>
                  <option value="lg">Grande</option>
                  <option value="xl">Extra grande</option>
                </SelectInput>
              </Field>
            </FormGrid>
          )}

          {form.type === 'countdown' && (
            <Alert tone="warning">La fecha <b>«Hasta»</b> se usa como meta del contador. Cuando llega a 0, el anuncio deja de mostrarse.</Alert>
          )}

          {withImage && (
            <Field label="Imagen" hint="Opcional.">
              <ImageInput value={form.imageUrl} onChange={(v) => set('imageUrl', v)} ratio="landscape" />
            </Field>
          )}

          <FormGrid cols={3}>
            <Field label="Texto del botón"><TextInput value={form.ctaText || ''} onChange={(e) => set('ctaText', e.target.value)} placeholder="Ver ofertas" /></Field>
            <Field label="Enlace del botón"><TextInput value={form.ctaUrl || ''} onChange={(e) => set('ctaUrl', e.target.value)} placeholder="/catalog o https://" /></Field>
            <Field label="Cupón"><TextInput value={form.couponCode || ''} onChange={(e) => set('couponCode', e.target.value)} placeholder="BIENVENIDA10" className="font-mono" /></Field>
          </FormGrid>

          <FormGrid>
            <Field label="Color de fondo" hint="Vacío: usa el estilo elegido o el color de marca.">
              <ColorInput value={form.bgColor || ''} onChange={(v) => set('bgColor', v)} />
            </Field>
            <Field label="Color del texto" hint={(form.bgColor || form.textColor)
              ? <button type="button" onClick={() => { set('bgColor', ''); set('textColor', ''); }} className="text-app-700 hover:underline">Quitar colores propios</button>
              : 'Vacío: blanco o el del estilo.'}>
              <ColorInput value={form.textColor || ''} onChange={(v) => set('textColor', v)} />
            </Field>
          </FormGrid>

          <FormGrid cols={3}>
            <Field label="Dónde mostrar">
              <SelectInput value={form.target} onChange={(e) => set('target', e.target.value as AnnouncementInput['target'])}>
                {Object.entries(TARGET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </SelectInput>
            </Field>
            <Field label="Frecuencia">
              <SelectInput value={form.frequency} onChange={(e) => set('frequency', e.target.value as AnnouncementInput['frequency'])}>
                {Object.entries(FREQ_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </SelectInput>
            </Field>
            <Field label="Prioridad" hint="Mayor se muestra primero."><NumberInput value={form.priority} onChange={(e) => set('priority', Number(e.target.value))} /></Field>
          </FormGrid>

          <FormGrid>
            <Field label="Desde" hint="Opcional"><TextInput type="datetime-local" value={toLocalInput(form.startsAt)} onChange={(e) => set('startsAt', e.target.value || null)} /></Field>
            <Field label="Hasta" hint={form.type === 'countdown' ? 'Meta del contador' : 'Opcional'}><TextInput type="datetime-local" value={toLocalInput(form.endsAt)} onChange={(e) => set('endsAt', e.target.value || null)} /></Field>
          </FormGrid>

          <div className="space-y-3 pt-1">
            <Switch checked={form.isActive} onChange={(v) => set('isActive', v)} label="Activo" description="Solo los anuncios activos se muestran en la tienda." />
            <Switch checked={form.dismissible} onChange={(v) => set('dismissible', v)} label="Se puede cerrar" description="Muestra la ✕ para que el cliente lo oculte." />
          </div>
        </div>
      </Dialog>
    </Page>
  );
}
