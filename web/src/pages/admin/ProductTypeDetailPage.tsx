import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Shirt, Trash2 } from 'lucide-react';
import { catalogsService } from '../../services/catalogs.service';
import type { ProductType } from '../../services/catalogs.service';
import { ProductTypeForm } from '../../components/admin/ProductTypeForm';
import { Button, Card, FormActions, Page, PageHeader, Spinner, toast, useConfirm } from '../../components/ui';

const LIST = '/admin-panel/catalogs/product-types';

/** Crear / editar un tipo de producto en pantalla propia (la lista usa un diálogo; esta vista no tiene ruta en App.tsx). */
export const ProductTypeDetailPage = () => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { id } = useParams<{ id: string }>();
  const isEditing = id !== 'new';

  const [productType, setProductType] = useState<ProductType | undefined>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing || !id) return;
    setLoading(true);
    catalogsService.getProductTypeById(Number(id))
      .then(setProductType)
      .catch((error) => { console.error('Error cargando datos:', error); toast.error('Error al cargar los datos'); })
      .finally(() => setLoading(false));
  }, [id, isEditing]);

  const handleSubmit = async (formData: Omit<ProductType, 'id'>, sizeIds: number[]) => {
    try {
      setSaving(true);
      if (isEditing && id) {
        await catalogsService.updateProductType(Number(id), formData);
        await catalogsService.assignSizesToProductType(Number(id), sizeIds);
      } else {
        const newType = await catalogsService.createProductType(formData);
        await catalogsService.assignSizesToProductType(newType.id, sizeIds);
      }
      toast.success('Tipo de producto guardado');
      navigate(LIST);
    } catch (error) {
      console.error('Error guardando tipo:', error);
      toast.error('Error al guardar el tipo de producto');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm({ title: '¿Eliminar este tipo de producto?', message: 'Esta acción no se puede deshacer.', tone: 'danger' }))) return;
    try {
      setSaving(true);
      await catalogsService.deleteProductType(Number(id));
      toast.success('Tipo de producto eliminado');
      navigate(LIST);
    } catch (error) {
      console.error('Error eliminando tipo:', error);
      toast.error('Error al eliminar el tipo de producto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <PageHeader
        icon={Shirt}
        backTo={LIST}
        title={isEditing ? 'Editar tipo de producto' : 'Nuevo tipo de producto'}
        subtitle="Configura el tipo de producto y las tallas disponibles"
      />
      {loading ? <Spinner label="Cargando…" /> : (
        <Card>
          <ProductTypeForm key={productType?.id ?? 'new'} formId="pt-detail-form" productType={productType} onSubmit={handleSubmit} />
          <FormActions>
            {isEditing && (
              <Button variant="danger" className="sm:mr-auto" onClick={handleDelete} disabled={saving} icon={<Trash2 className="w-4 h-4" />}>Eliminar</Button>
            )}
            <Button variant="secondary" onClick={() => navigate(LIST)}>Cancelar</Button>
            <Button type="submit" form="pt-detail-form" isLoading={saving} icon={<Save className="w-4 h-4" />}>Guardar</Button>
          </FormActions>
        </Card>
      )}
    </Page>
  );
};
