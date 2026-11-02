import { useState } from 'react';
import { Palette } from 'lucide-react';
import { useCatalogs } from '../../../context/CatalogsContext';
import { ColorInput, Field, Switch, TextInput, toast, useConfirm } from '../../../components/ui';
import type { Color } from '../../../types/catalog';
import { CatalogDialog, CatalogListPage, errMsg } from './CatalogListPage';

const EMPTY = { name: '', hexCode: '#000000', isActive: true };
const HEX = /^#[0-9A-Fa-f]{6}$/;

export const ColorsPage = () => {
  const { colors, isLoading, addColor, updateColor, deleteColor } = useCatalogs();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Color | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (c: Color) => {
    setEditing(c);
    setForm({ name: c.name, hexCode: c.hexCode, isActive: c.isActive });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Escribe el nombre del color'); return; }
    if (!HEX.test(form.hexCode)) { toast.error('El código debe tener el formato #RRGGBB'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateColor(editing.id, form);
        toast.success('Color actualizado');
      } else {
        await addColor(form);
        toast.success('Color creado');
      }
      setOpen(false);
    } catch (err) {
      toast.error(errMsg(err, 'No se pudo guardar el color'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Color) => {
    if (!(await confirm({ title: `¿Eliminar el color "${c.name}"?`, message: 'Esta acción no se puede deshacer.', tone: 'danger' }))) return;
    try {
      await deleteColor(c.id);
      toast.success('Color eliminado');
      setOpen(false);
    } catch (err) {
      toast.error(errMsg(err, 'No se pudo eliminar el color'));
    }
  };

  return (
    <>
      <CatalogListPage<Color>
        icon={Palette}
        title="Colores"
        subtitle="Colores disponibles para los productos"
        newLabel="Nuevo color"
        noun="colores"
        rows={colors}
        loading={isLoading}
        defaultSort="name"
        searchText={(c) => `${c.name} ${c.hexCode}`}
        searchPlaceholder="Buscar por nombre o código…"
        columns={[
          {
            key: 'name', header: 'Nombre', sort: (c) => c.name,
            render: (c) => (
              <span className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-md border border-gray-200 flex-shrink-0" style={{ backgroundColor: c.hexCode }} />
                <span className="font-medium text-gray-900">{c.name}</span>
              </span>
            ),
          },
          { key: 'hexCode', header: 'Código', render: (c) => <span className="font-mono text-xs uppercase text-gray-500">{c.hexCode}</span> },
        ]}
        onNew={openNew}
        onEdit={openEdit}
        onDelete={remove}
      />

      <CatalogDialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar color' : 'Nuevo color'}
        formId="color-form"
        saving={saving}
        isEdit={!!editing}
        onDelete={editing ? () => remove(editing) : undefined}
      >
        <form id="color-form" onSubmit={submit} className="space-y-4">
          <Field label="Nombre" required htmlFor="color-name">
            <TextInput id="color-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Azul marino" required autoFocus />
          </Field>
          <Field label="Color" required hint="Formato: #RRGGBB" error={form.hexCode && !HEX.test(form.hexCode) ? 'Código no válido' : undefined}>
            <ColorInput value={form.hexCode} onChange={(hex) => setForm({ ...form, hexCode: hex })} />
          </Field>
          <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Activo" description="Los colores inactivos no se ofrecen al crear productos." />
        </form>
      </CatalogDialog>
    </>
  );
};
