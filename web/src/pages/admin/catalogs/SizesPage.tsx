import { useState } from 'react';
import { Ruler } from 'lucide-react';
import { useCatalogs } from '../../../context/CatalogsContext';
import { Badge, Field, FormGrid, NumberInput, Switch, TextInput, toast, useConfirm } from '../../../components/ui';
import type { Size } from '../../../types/catalog';
import { CatalogDialog, CatalogListPage, ctxId, errMsg } from './CatalogListPage';

const EMPTY = { name: '', abbreviation: '', sortOrder: 0, isActive: true };

export const SizesPage = () => {
  const { sizes, isLoading, addSize, updateSize, deleteSize } = useCatalogs();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Size | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing(null); setForm({ ...EMPTY, sortOrder: sizes.length + 1 }); setOpen(true); };
  const openEdit = (s: Size) => {
    setEditing(s);
    setForm({ name: s.name, abbreviation: s.abbreviation, sortOrder: s.sortOrder, isActive: s.isActive });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.abbreviation.trim()) { toast.error('Completa el nombre y la abreviación'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateSize(ctxId(editing.id), form);
        toast.success('Talla actualizada');
      } else {
        await addSize(form);
        toast.success('Talla creada');
      }
      setOpen(false);
    } catch (err) {
      toast.error(errMsg(err, 'No se pudo guardar la talla'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: Size) => {
    if (!(await confirm({ title: `¿Eliminar la talla "${s.name}"?`, message: 'Esta acción no se puede deshacer.', tone: 'danger' }))) return;
    try {
      await deleteSize(ctxId(s.id));
      toast.success('Talla eliminada');
      setOpen(false);
    } catch (err) {
      toast.error(errMsg(err, 'No se pudo eliminar la talla'));
    }
  };

  return (
    <>
      <CatalogListPage<Size>
        icon={Ruler}
        title="Tallas"
        subtitle="Tallas disponibles para los productos"
        newLabel="Nueva talla"
        noun="tallas"
        rows={sizes}
        loading={isLoading}
        defaultSort="sortOrder"
        searchText={(s) => `${s.name} ${s.abbreviation}`}
        searchPlaceholder="Buscar por nombre o abreviación…"
        columns={[
          { key: 'name', header: 'Nombre', sort: (s) => s.name, render: (s) => <span className="font-medium text-gray-900">{s.name}</span> },
          { key: 'abbreviation', header: 'Abreviación', sort: (s) => s.abbreviation, render: (s) => <Badge>{s.abbreviation}</Badge> },
          { key: 'sortOrder', header: 'Orden', align: 'right', sort: (s) => s.sortOrder, render: (s) => <span className="tabular-nums">{s.sortOrder}</span> },
        ]}
        onNew={openNew}
        onEdit={openEdit}
        onDelete={remove}
      />

      <CatalogDialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar talla' : 'Nueva talla'}
        formId="size-form"
        saving={saving}
        isEdit={!!editing}
        onDelete={editing ? () => remove(editing) : undefined}
      >
        <form id="size-form" onSubmit={submit} className="space-y-4">
          <Field label="Nombre" required htmlFor="size-name">
            <TextInput id="size-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Extra Large" required autoFocus />
          </Field>
          <FormGrid>
            <Field label="Abreviación" required htmlFor="size-abbr">
              <TextInput id="size-abbr" value={form.abbreviation} onChange={(e) => setForm({ ...form, abbreviation: e.target.value })} placeholder="Ej: XL" required />
            </Field>
            <Field label="Orden" required htmlFor="size-order" hint="Posición en las listas de tallas.">
              <NumberInput id="size-order" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) })} min="1" step="1" required />
            </Field>
          </FormGrid>
          <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Activa" description="Las tallas inactivas no se ofrecen al crear productos." />
        </form>
      </CatalogDialog>
    </>
  );
};
