import { useState } from 'react';
import { FolderTree } from 'lucide-react';
import { useCatalogs } from '../../../context/CatalogsContext';
import { Field, Switch, TextArea, TextInput, toast, useConfirm } from '../../../components/ui';
import type { Category } from '../../../types/catalog';
import { CatalogDialog, CatalogListPage, errMsg } from './CatalogListPage';

const EMPTY = { name: '', description: '', isActive: true };

export const CategoriesPage = () => {
  const { categories, isLoading, addCategory, updateCategory, deleteCategory } = useCatalogs();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({ name: c.name, description: c.description || '', isActive: c.isActive });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Escribe el nombre de la categoría'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, form);
        toast.success('Categoría actualizada');
      } else {
        await addCategory(form);
        toast.success('Categoría creada');
      }
      setOpen(false);
    } catch (err) {
      toast.error(errMsg(err, 'No se pudo guardar la categoría'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Category) => {
    if (!(await confirm({ title: `¿Eliminar la categoría "${c.name}"?`, message: 'Esta acción no se puede deshacer.', tone: 'danger' }))) return;
    try {
      await deleteCategory(c.id);
      toast.success('Categoría eliminada');
      setOpen(false);
    } catch (err) {
      toast.error(errMsg(err, 'No se pudo eliminar la categoría'));
    }
  };

  return (
    <>
      <CatalogListPage<Category>
        icon={FolderTree}
        title="Categorías"
        subtitle="Agrupan los productos de la tienda"
        newLabel="Nueva categoría"
        noun="categorías"
        rows={categories}
        loading={isLoading}
        defaultSort="name"
        searchText={(c) => `${c.name} ${c.description ?? ''}`}
        searchPlaceholder="Buscar por nombre o descripción…"
        columns={[
          { key: 'name', header: 'Nombre', sort: (c) => c.name, render: (c) => <span className="font-medium text-gray-900">{c.name}</span> },
          { key: 'description', header: 'Descripción', render: (c) => <span className="text-gray-500">{c.description || '—'}</span> },
        ]}
        onNew={openNew}
        onEdit={openEdit}
        onDelete={remove}
      />

      <CatalogDialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar categoría' : 'Nueva categoría'}
        formId="category-form"
        saving={saving}
        isEdit={!!editing}
        onDelete={editing ? () => remove(editing) : undefined}
      >
        <form id="category-form" onSubmit={submit} className="space-y-4">
          <Field label="Nombre" required htmlFor="cat-name">
            <TextInput id="cat-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Ropa" required autoFocus />
          </Field>
          <Field label="Descripción" htmlFor="cat-desc">
            <TextArea id="cat-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción de la categoría" rows={3} />
          </Field>
          <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Activa" description="Las categorías inactivas no se muestran en la tienda." />
        </form>
      </CatalogDialog>
    </>
  );
};
