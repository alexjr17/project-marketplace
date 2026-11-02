import { useState } from 'react';
import { Shirt } from 'lucide-react';
import { useCatalogs } from '../../context/CatalogsContext';
import { ProductTypeForm } from '../../components/admin/ProductTypeForm';
import { Badge, toast, useConfirm } from '../../components/ui';
import type { ProductType } from '../../services/catalogs.service';
import { CatalogDialog, CatalogListPage, errMsg } from './catalogs/CatalogListPage';

/** Tipos de producto (pestaña de Atributos). Mismo patrón que Categorías, Tallas y Colores. */
export const ProductTypesPage = () => {
  const { productTypes, categories, isLoading, createProductType, updateProductTypeWithSizes, deleteProductType } = useCatalogs();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ProductType | null>(null);
  const [saving, setSaving] = useState(false);

  const categoryName = (id?: number | null) => (id ? categories.find(c => c.id === id)?.name : undefined);

  const openNew = () => { setSelected(null); setOpen(true); };
  const openEdit = (t: ProductType) => { setSelected(t); setOpen(true); };

  const handleSubmit = async (typeData: Omit<ProductType, 'id'>, sizeIds: number[]) => {
    setSaving(true);
    try {
      if (selected) {
        await updateProductTypeWithSizes(selected.id, typeData, sizeIds);
        toast.success('Tipo de producto actualizado');
      } else {
        await createProductType(typeData, sizeIds);
        toast.success('Tipo de producto creado');
      }
      setOpen(false);
      setSelected(null);
    } catch (err) {
      toast.error(errMsg(err, 'No se pudo guardar el tipo de producto'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: ProductType) => {
    if (!(await confirm({ title: `¿Eliminar el tipo "${t.name}"?`, message: 'Esta acción no se puede deshacer.', tone: 'danger' }))) return;
    try {
      await deleteProductType(t.id as unknown as string);
      toast.success('Tipo de producto eliminado');
      setOpen(false);
      setSelected(null);
    } catch (err) {
      toast.error(errMsg(err, 'No se pudo eliminar el tipo de producto'));
    }
  };

  return (
    <>
      <CatalogListPage<ProductType>
        icon={Shirt}
        title="Tipos de producto"
        subtitle="Tipos de prenda o artículo y las tallas que manejan"
        newLabel="Nuevo tipo"
        noun="tipos de producto"
        rows={productTypes}
        loading={isLoading}
        defaultSort="name"
        searchText={(t) => `${t.name} ${t.slug} ${t.description ?? ''} ${categoryName(t.categoryId) ?? ''}`}
        searchPlaceholder="Buscar por nombre, slug o categoría…"
        columns={[
          {
            key: 'name', header: 'Nombre', sort: (t) => t.name,
            render: (t) => (
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{t.name}</p>
                {t.description && <p className="text-xs text-gray-500 truncate max-w-xs">{t.description}</p>}
              </div>
            ),
          },
          {
            key: 'category', header: 'Categoría', sort: (t) => categoryName(t.categoryId) ?? '',
            render: (t) => (categoryName(t.categoryId) ? <Badge tone="blue">{categoryName(t.categoryId)}</Badge> : <span className="text-gray-400">Sin categoría</span>),
          },
          { key: 'slug', header: 'Slug', render: (t) => <span className="font-mono text-xs text-gray-500">{t.slug}</span> },
        ]}
        onNew={openNew}
        onEdit={openEdit}
        onDelete={remove}
      />

      <CatalogDialog
        open={open}
        onClose={() => setOpen(false)}
        title={selected ? 'Editar tipo de producto' : 'Nuevo tipo de producto'}
        description="Datos del tipo y tallas que se pueden usar con él."
        formId="product-type-form"
        saving={saving}
        isEdit={!!selected}
        onDelete={selected ? () => remove(selected) : undefined}
        size="lg"
      >
        <ProductTypeForm key={selected?.id ?? 'new'} formId="product-type-form" productType={selected ?? undefined} onSubmit={handleSubmit} />
      </CatalogDialog>
    </>
  );
};
