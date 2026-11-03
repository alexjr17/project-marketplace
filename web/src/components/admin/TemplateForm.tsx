import { useState, useEffect } from 'react';
import { Check, Eye, Image as ImageIcon, Info, Layers, Save, Tag, Trash2 } from 'lucide-react';
import type { Template } from '../../services/templates.service';
import { catalogsService } from '../../services/catalogs.service';
import type { Color, Size, Category, ProductType as CatalogProductType } from '../../types/catalog';
import {
  Alert, Button, Card, CardTitle, Field, FormActions, FormGrid, ImageInput, MoneyInput, SelectInput, Switch,
  TextArea, TextInput,
} from '../ui';

interface TemplateFormProps {
  template?: Template;
  onSubmit: (data: TemplateFormData) => Promise<void>;
  onDelete?: () => void;
  /** Botón Cancelar del pie (si no se pasa, no se muestra). */
  onCancel?: () => void;
}

export interface TemplateFormData {
  name: string;
  description: string;
  sku: string;
  slug: string;
  categoryId: number | null;
  typeId: number | null;
  basePrice: number;
  /** Vistas base del modelo (la API las guarda como objeto {front, back, side}). */
  images: TemplateImages;
  tags: string[];
  colorIds: number[];
  sizeIds: number[];
  isActive: boolean;
}

export interface TemplateImages {
  front: string;
  back: string;
  side: string;
}

const IMAGE_SLOTS: { key: keyof TemplateImages; label: string; hint: string }[] = [
  { key: 'front', label: 'Frente', hint: 'Vista principal del personalizador y del catálogo.' },
  { key: 'back', label: 'Espalda', hint: 'Opcional.' },
  { key: 'side', label: 'Lado', hint: 'Opcional.' },
];

/** Imágenes del modelo como {front, back, side}; acepta también la lista que se guardaba antes. */
const getTemplateImages = (template?: Template): TemplateImages => {
  const raw = template?.images as unknown;
  if (Array.isArray(raw)) return { front: raw[0] || '', back: raw[1] || '', side: raw[2] || '' };
  const o = (raw || {}) as Partial<TemplateImages>;
  return { front: o.front || '', back: o.back || '', side: o.side || '' };
};

/** Ficha del modelo personalizable: una tarjeta por tema y pie de botones fijo. */
export const TemplateForm = ({ template, onSubmit, onDelete, onCancel }: TemplateFormProps) => {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    sku: template?.sku || '',
    slug: template?.slug || '',
    typeId: template?.typeId || null as number | null,
    categoryId: template?.categoryId || null as number | null,
    basePrice: template?.basePrice || 0,
    isActive: template?.isActive ?? true,
    tags: template?.tags?.join(', ') || '',
  });
  const [saving, setSaving] = useState(false);

  // Vistas base: frente, espalda y lado
  const [images, setImages] = useState<TemplateImages>(getTemplateImages(template));

  // Catálogos disponibles
  const [availableColors, setAvailableColors] = useState<Color[]>([]);
  const [availableSizes, setAvailableSizes] = useState<Size[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [availableProductTypes, setAvailableProductTypes] = useState<CatalogProductType[]>([]);

  // IDs seleccionados
  const [selectedColorIds, setSelectedColorIds] = useState<number[]>(
    template?.colors?.map(c => c.id) || []
  );
  const [selectedSizeIds, setSelectedSizeIds] = useState<number[]>(
    template?.sizes?.map(s => s.id) || []
  );

  // ¿Maneja variantes de color/talla? Si no, se guarda como modelo simple.
  const [hasVariants, setHasVariants] = useState<boolean>(
    (template?.colors?.length ?? 0) > 0 || (template?.sizes?.length ?? 0) > 0
  );

  // Cargar catálogos al montar
  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const [colors, categories, productTypes] = await Promise.all([
          catalogsService.getColors(),
          catalogsService.getCategories(),
          catalogsService.getProductTypes(),
        ]);
        setAvailableColors(colors);
        setAvailableCategories(categories);
        setAvailableProductTypes(productTypes);
      } catch (error) {
        console.error('Error cargando catálogos:', error);
      }
    };
    loadCatalogs();
  }, []);

  // Cargar tallas cuando cambia el tipo de producto
  useEffect(() => {
    const loadSizes = async () => {
      if (formData.typeId) {
        try {
          const sizes = await catalogsService.getSizesByProductType(formData.typeId);
          setAvailableSizes(sizes);
          // Limpiar tallas seleccionadas que no estén disponibles para este tipo
          setSelectedSizeIds(prev => prev.filter(id => sizes.some(s => s.id === id)));
        } catch (error) {
          console.error('Error cargando tallas:', error);
          setAvailableSizes([]);
        }
      } else {
        // Si no hay tipo seleccionado, mostrar todas las tallas
        try {
          const sizes = await catalogsService.getSizes();
          setAvailableSizes(sizes);
        } catch (error) {
          console.error('Error cargando tallas:', error);
        }
      }
    };
    loadSizes();
  }, [formData.typeId]);

  // Limpiar typeId si la categoría cambia y el tipo actual no pertenece a la nueva categoría
  useEffect(() => {
    if (formData.categoryId && formData.typeId) {
      const currentType = availableProductTypes.find(t => t.id === formData.typeId);
      if (currentType && currentType.categoryId !== formData.categoryId) {
        setFormData(prev => ({ ...prev, typeId: null }));
        setSelectedSizeIds([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.categoryId, availableProductTypes]);

  // Auto-generar slug desde el nombre
  useEffect(() => {
    if (!template && formData.name) {
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setFormData(prev => ({ ...prev, slug }));
    }
  }, [formData.name, template]);

  // Auto-generar SKU si no existe
  useEffect(() => {
    if (!template && !formData.sku && formData.slug) {
      const sku = `TPL-${formData.slug.toUpperCase().substring(0, 10)}-${Date.now().toString().slice(-4)}`;
      setFormData(prev => ({ ...prev, sku }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.slug, template]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const templateData: TemplateFormData = {
      name: formData.name,
      description: formData.description,
      sku: formData.sku,
      slug: formData.slug,
      typeId: formData.typeId,
      categoryId: formData.categoryId,
      basePrice: Number(formData.basePrice),
      isActive: formData.isActive,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      images,
      colorIds: hasVariants ? selectedColorIds : [],
      sizeIds: hasVariants ? selectedSizeIds : [],
    };

    setSaving(true);
    try {
      await onSubmit(templateData);
    } finally {
      setSaving(false);
    }
  };

  const toggleColor = (colorId: number) => {
    setSelectedColorIds(prev => (prev.includes(colorId) ? prev.filter(id => id !== colorId) : [...prev, colorId]));
  };

  const toggleSize = (sizeId: number) => {
    setSelectedSizeIds(prev => (prev.includes(sizeId) ? prev.filter(id => id !== sizeId) : [...prev, sizeId]));
  };

  const missingVariants = hasVariants && (selectedColorIds.length === 0 || selectedSizeIds.length === 0);
  const chip = (on: boolean) =>
    `relative flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${on ? 'border-app-500 bg-app-50 ring-1 ring-app-500 text-app-800' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <div className="xl:col-span-2 space-y-5">
          {/* Información */}
          <Card>
            <CardTitle icon={Info}>Información</CardTitle>
            <div className="space-y-4">
              <Field label="Nombre del modelo" required htmlFor="tf-name">
                <TextInput id="tf-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </Field>
              <Field label="Descripción" required htmlFor="tf-desc">
                <TextArea id="tf-desc" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} required />
              </Field>
              <FormGrid>
                <Field label="Categoría" required htmlFor="tf-cat">
                  <SelectInput id="tf-cat" value={formData.categoryId || ''} required
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Selecciona una categoría</option>
                    {availableCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </SelectInput>
                </Field>
                <Field label="Tipo de producto" required htmlFor="tf-type" hint="Define las tallas disponibles.">
                  <SelectInput id="tf-type" value={formData.typeId || ''} required
                    onChange={(e) => setFormData({ ...formData, typeId: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Selecciona un tipo</option>
                    {availableProductTypes
                      .filter(type => !formData.categoryId || type.categoryId === formData.categoryId)
                      .map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </SelectInput>
                </Field>
                <Field label="SKU" required htmlFor="tf-sku" hint={!template ? 'Se genera con el nombre; puedes cambiarlo.' : undefined}>
                  <TextInput id="tf-sku" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} required className="font-mono" />
                </Field>
                <Field label="Slug (URL amigable)" htmlFor="tf-slug" hint={template ? 'No se puede cambiar después de crear el modelo.' : undefined}>
                  <TextInput id="tf-slug" value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} placeholder="camiseta-basica" disabled={!!template} className="font-mono" />
                </Field>
              </FormGrid>
              <Field label="Etiquetas" htmlFor="tf-tags" hint="Separadas por coma.">
                <TextInput id="tf-tags" value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} placeholder="básico, algodón, unisex" />
              </Field>
            </div>
          </Card>

          {/* Imágenes */}
          <Card>
            <CardTitle icon={ImageIcon}>Imágenes</CardTitle>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {IMAGE_SLOTS.map(({ key, label, hint }) => (
                <Field key={key} label={label} hint={hint}>
                  <ImageInput value={images[key]} onChange={(v) => setImages(prev => ({ ...prev, [key]: v }))} maxSizeMB={5} />
                </Field>
              ))}
            </div>
            {!images.front && <p className="text-xs text-gray-400 mt-2">Sin imagen de frente: el personalizador muestra una silueta de respaldo. Las imágenes de cada zona (Frente, Espalda, Mangas…) se cargan en el editor de zonas.</p>}
          </Card>

          {/* Variantes */}
          <Card>
            <CardTitle icon={Layers}>Variantes</CardTitle>
            <Switch
              checked={hasVariants}
              onChange={(next) => {
                setHasVariants(next);
                if (!next) { setSelectedColorIds([]); setSelectedSizeIds([]); }
              }}
              label="Se vende en colores o tallas"
              description="Actívalo solo si el modelo tiene distintos colores o tallas. Si no, se guarda como modelo simple."
            />

            {hasVariants && (
              <div className="mt-5 space-y-5">
                {missingVariants && <Alert tone="warning">Selecciona al menos un color y una talla para poder guardar.</Alert>}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Colores <span className="text-red-500">*</span>
                    <span className="ml-2 text-xs font-normal text-gray-500">{selectedColorIds.length} seleccionado{selectedColorIds.length !== 1 ? 's' : ''}</span>
                  </p>
                  {availableColors.length === 0 ? (
                    <p className="text-sm text-gray-500">Cargando colores…</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-72 overflow-y-auto p-0.5">
                      {availableColors.map(color => {
                        const on = selectedColorIds.includes(color.id);
                        return (
                          <button key={color.id} type="button" aria-pressed={on} onClick={() => toggleColor(color.id)} className={chip(on)}>
                            <span className="w-5 h-5 rounded-md border border-gray-300 flex-shrink-0" style={{ backgroundColor: color.hexCode }} title={color.hexCode} />
                            <span className="truncate flex-1">{color.name}</span>
                            {on && <Check className="w-4 h-4 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Tallas <span className="text-red-500">*</span>
                    <span className="ml-2 text-xs font-normal text-gray-500">{selectedSizeIds.length} seleccionada{selectedSizeIds.length !== 1 ? 's' : ''}</span>
                  </p>
                  {!formData.typeId ? (
                    <p className="text-sm text-gray-500">Selecciona un tipo de producto para ver sus tallas.</p>
                  ) : availableSizes.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay tallas asignadas a este tipo de producto.</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                      {availableSizes.map(size => {
                        const on = selectedSizeIds.includes(size.id);
                        return (
                          <button key={size.id} type="button" aria-pressed={on} onClick={() => toggleSize(size.id)} title={size.name} className={`${chip(on)} justify-center flex-col !gap-0`}>
                            <span className="font-semibold">{size.abbreviation}</span>
                            <span className="text-[11px] text-gray-500 truncate max-w-full">{size.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardTitle icon={Tag}>Precio</CardTitle>
            <Field label="Precio base" required htmlFor="tf-price" hint="Precio del modelo sin personalización.">
              <MoneyInput id="tf-price" value={formData.basePrice} onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) })} required />
            </Field>
          </Card>
          <Card>
            <CardTitle icon={Eye}>Publicación</CardTitle>
            <Switch checked={formData.isActive} onChange={(v) => setFormData({ ...formData, isActive: v })} label="Activo" description="Los modelos inactivos no se ofrecen en el personalizador." />
          </Card>
        </div>
      </div>

      <FormActions sticky>
        {onDelete && (
          <Button variant="danger" className="sm:mr-auto" onClick={onDelete} icon={<Trash2 className="w-4 h-4" />}>Eliminar modelo</Button>
        )}
        {onCancel && <Button variant="secondary" onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" isLoading={saving} disabled={missingVariants} icon={<Save className="w-4 h-4" />}>
          {template ? 'Guardar cambios' : 'Crear modelo'}
        </Button>
      </FormActions>
    </form>
  );
};
