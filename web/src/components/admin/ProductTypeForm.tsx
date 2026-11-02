import { useState, useEffect } from 'react';
import type { ProductType } from '../../types/catalog';
import { catalogsService } from '../../services/catalogs.service';
import { useCatalogs } from '../../context/CatalogsContext';
import { Button, Field, FormActions, FormGrid, SelectInput, Spinner, Switch, TextArea, TextInput, toast } from '../ui';
import { Check, Trash2 } from 'lucide-react';

interface ProductTypeFormProps {
  productType?: ProductType;
  onSubmit: (data: Omit<ProductType, 'id'>, sizeIds: number[]) => void;
  onDelete?: () => void;
  /** Si se pasa, el formulario no pinta sus botones: los pone quien lo contiene (p. ej. el pie de un Dialog) con `form={formId}`. */
  formId?: string;
}

export const ProductTypeForm = ({ productType, onSubmit, onDelete, formId }: ProductTypeFormProps) => {
  // Usar datos del contexto en lugar de hacer nuevas peticiones
  const { sizes: availableSizes, categories } = useCatalogs();

  const [formData, setFormData] = useState({
    name: productType?.name || '',
    slug: productType?.slug || '',
    description: productType?.description || '',
    categoryId: productType?.categoryId || null as number | null,
    isActive: productType?.isActive ?? true,
  });

  const [selectedSizeIds, setSelectedSizeIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedTypeId, setLoadedTypeId] = useState<number | null>(null);

  useEffect(() => {
    // Solo cargar si es un tipo diferente al ya cargado
    if (productType?.id && productType.id !== loadedTypeId) {
      loadAssignedSizes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productType?.id]);

  const loadAssignedSizes = async () => {
    if (!productType?.id) return;

    try {
      setLoading(true);
      const assignedSizes = await catalogsService.getSizesByProductType(productType.id);
      const validSizes = Array.isArray(assignedSizes) ? assignedSizes : [];
      setSelectedSizeIds(validSizes.map(s => s.id));
      setLoadedTypeId(productType.id); // Marcar como cargado
    } catch (error) {
      setSelectedSizeIds([]);
      console.error('Error cargando tallas asignadas:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData({ ...formData, name, slug: generateSlug(name) });
  };

  const toggleSize = (sizeId: number) => {
    setSelectedSizeIds(prev => (prev.includes(sizeId) ? prev.filter(id => id !== sizeId) : [...prev, sizeId]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSizeIds.length === 0) {
      toast.error('Selecciona al menos una talla');
      return;
    }
    onSubmit(formData, selectedSizeIds);
  };

  if (loading) return <Spinner label="Cargando tallas…" />;

  const allSelected = availableSizes.length > 0 && selectedSizeIds.length === availableSizes.length;

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-5">
      <FormGrid>
        <Field label="Nombre" required htmlFor="pt-name">
          <TextInput id="pt-name" value={formData.name} onChange={(e) => handleNameChange(e.target.value)} required placeholder="Ej: Camiseta, Taza, Gorra…" autoFocus />
        </Field>
        <Field label="Slug" required htmlFor="pt-slug" hint="Se genera con el nombre; se usa en las URL.">
          <TextInput id="pt-slug" value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} required placeholder="camiseta" className="font-mono" />
        </Field>
        <Field label="Categoría" htmlFor="pt-cat">
          <SelectInput id="pt-cat" value={formData.categoryId || ''} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Sin categoría</option>
            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </SelectInput>
        </Field>
        <div className="flex items-end pb-2">
          <div className="w-full">
            <Switch checked={formData.isActive} onChange={(v) => setFormData({ ...formData, isActive: v })} label="Activo" />
          </div>
        </div>
        <Field label="Descripción" htmlFor="pt-desc" className="md:col-span-2">
          <TextArea id="pt-desc" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} placeholder="Descripción opcional del tipo de producto…" />
        </Field>
      </FormGrid>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">Tallas disponibles <span className="text-red-500">*</span></p>
          {availableSizes.length > 0 && (
            <button type="button" className="text-xs font-medium text-app-700 hover:underline"
              onClick={() => setSelectedSizeIds(allSelected ? [] : availableSizes.map(s => s.id))}>
              {allSelected ? 'Quitar todas' : 'Seleccionar todas'}
            </button>
          )}
        </div>
        {availableSizes.length === 0 ? (
          <p className="text-sm text-gray-500">No hay tallas creadas. Créalas en la pestaña Tallas.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {availableSizes.map(size => {
              const on = selectedSizeIds.includes(size.id);
              return (
                <button key={size.id} type="button" onClick={() => toggleSize(size.id)} aria-pressed={on} title={size.name}
                  className={`relative rounded-lg border px-2 py-2 text-center transition-colors ${on ? 'border-app-500 bg-app-50 text-app-700 ring-1 ring-app-500' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                  {on && <Check className="absolute right-1 top-1 w-3 h-3" />}
                  <span className="block text-sm font-semibold">{size.abbreviation}</span>
                  <span className="block text-[11px] text-gray-500 truncate">{size.name}</span>
                </button>
              );
            })}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-2">
          {selectedSizeIds.length} talla{selectedSizeIds.length !== 1 ? 's' : ''} seleccionada{selectedSizeIds.length !== 1 ? 's' : ''} · selecciona al menos una
        </p>
      </div>

      {!formId && (
        <FormActions>
          {productType && onDelete && (
            <Button variant="danger" onClick={onDelete} icon={<Trash2 className="w-4 h-4" />} className="sm:mr-auto">Eliminar</Button>
          )}
          <Button type="submit">{productType ? 'Guardar' : 'Crear'}</Button>
        </FormActions>
      )}
    </form>
  );
};
