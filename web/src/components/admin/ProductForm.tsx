import { useState, useEffect } from 'react';
import type { Product } from '../../types/product';
import { Check, Image as ImageIcon, Info, Layers, Save, Star, Tag, Trash2 } from 'lucide-react';
import { catalogsService } from '../../services/catalogs.service';
import type { Color, Size, Category, ProductType as CatalogProductType } from '../../services/catalogs.service';
import {
  Alert, Button, Card, CardTitle, Field, FormActions, FormGrid, ImageGallery, ImageInput, MoneyInput, NumberInput,
  SelectInput, Switch, TextArea, TextInput, useConfirm,
} from '../ui';

const MAX_IMAGES = 5;

// Helper para obtener imágenes del producto (array plano)
function getProductImages(product?: Product): string[] {
  if (!product?.images) return [];
  // Si images es un array, usarlo directamente
  if (Array.isArray(product.images)) return (product.images as string[]).filter(Boolean);
  // Si es objeto con front/back/side, convertirlo a array
  const imgs = product.images as { front?: string; back?: string; side?: string };
  return [imgs.front, imgs.back, imgs.side].filter((img): img is string => !!img);
}

interface ProductFormProps {
  product?: Product;
  onSubmit: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: () => void;
  /** Botón Cancelar del pie (si no se pasa, no se muestra). */
  onCancel?: () => void;
  saving?: boolean;
}

/** Ficha de producto: una tarjeta por tema y el pie de botones fijo abajo. */
export const ProductForm = ({ product, onSubmit, onDelete, onCancel, saving }: ProductFormProps) => {
  const confirm = useConfirm();
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    typeId: product?.typeId || null as number | null,
    categoryId: product?.categoryId || null as number | null,
    basePrice: product?.basePrice || 0,
    stock: product?.stock || 0,
    featured: product?.featured || false,
    rating: product?.rating || 0,
    reviewsCount: product?.reviewsCount || 0,
    tags: product?.tags?.join(', ') || '',
  });

  // Imágenes (array; la primera es la principal)
  const [images, setImages] = useState<string[]>(getProductImages(product));

  // Catálogos disponibles
  const [availableColors, setAvailableColors] = useState<Color[]>([]);
  const [availableSizes, setAvailableSizes] = useState<Size[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [availableProductTypes, setAvailableProductTypes] = useState<CatalogProductType[]>([]);

  // IDs seleccionados
  const [selectedColorIds, setSelectedColorIds] = useState<number[]>(
    product?.colors?.map(c => c.id) || []
  );
  // Imagen por color (colorId -> data URI o URL).
  const [colorImages, setColorImages] = useState<Record<number, string>>(
    () => Object.fromEntries((product?.colors || []).filter(c => c.image).map(c => [c.id, c.image as string]))
  );
  const [selectedSizeIds, setSelectedSizeIds] = useState<number[]>(
    Array.isArray(product?.sizes)
      ? product.sizes.map(s => typeof s === 'string' ? 0 : s.id).filter(id => id > 0)
      : []
  );

  // ¿El producto maneja variantes de color/talla? Si no, es un producto simple
  // (una sola variante) — útil para comida y artículos sin tallas/colores.
  const [hasVariants, setHasVariants] = useState<boolean>(
    (product?.colors?.length ?? 0) > 0 ||
    (Array.isArray(product?.sizes) && product.sizes.length > 0)
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Convertir IDs a objetos completos para el backend.
    // Si el producto es simple (sin variantes), se envían color/tallas vacíos.
    const selectedColors = hasVariants ? availableColors.filter(c => selectedColorIds.includes(c.id)) : [];
    const selectedSizes = hasVariants ? availableSizes.filter(s => selectedSizeIds.includes(s.id)) : [];

    const productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
      name: formData.name,
      description: formData.description,
      // El backend recibe null cuando no hay tipo/categoría (los selects son obligatorios).
      typeId: formData.typeId as number,
      categoryId: formData.categoryId as number,
      basePrice: Number(formData.basePrice),
      stock: Number(formData.stock),
      featured: formData.featured,
      rating: formData.rating || undefined,
      reviewsCount: formData.reviewsCount || undefined,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      // El backend recibe la lista plana de imágenes (la primera es la principal).
      images: images.filter(Boolean) as unknown as Product['images'],
      colors: selectedColors.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        hexCode: c.hexCode,
        image: colorImages[c.id] || undefined,
      })),
      sizes: selectedSizes.map(s => ({
        id: s.id,
        name: s.name,
        abbreviation: s.abbreviation,
      })),
    };

    onSubmit(productData);
  };

  const toggleColor = (colorId: number) => {
    setSelectedColorIds(prev => (prev.includes(colorId) ? prev.filter(id => id !== colorId) : [...prev, colorId]));
  };

  const toggleSize = (sizeId: number) => {
    setSelectedSizeIds(prev => (prev.includes(sizeId) ? prev.filter(id => id !== sizeId) : [...prev, sizeId]));
  };

  const toggleVariants = async (next: boolean) => {
    if (!next) {
      // Apagar variantes en un producto que YA tenía color/talla puede
      // afectar variantes con stock/ventas: pedir confirmación.
      const hadVariants = (product?.colors?.length ?? 0) > 0 ||
        (Array.isArray(product?.sizes) && product.sizes.length > 0);
      if (hadVariants) {
        const stockNote = (product?.stock ?? 0) > 0 ? ` El producto tiene stock (${product?.stock}).` : '';
        const ok = await confirm({
          title: '¿Convertir en producto simple?',
          message: `Este producto tiene variantes de color/talla.${stockNote} Si lo conviertes en producto simple, esas variantes dejarán de usarse y el inventario pasará a una sola variante. Esto puede afectar el stock y los reportes.`,
          confirmText: 'Convertir',
          tone: 'danger',
        });
        if (!ok) return;
      }
      setSelectedColorIds([]);
      setSelectedSizeIds([]);
    }
    setHasVariants(next);
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
              <Field label="Nombre del producto" required htmlFor="pf-name">
                <TextInput id="pf-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </Field>
              <Field label="Descripción" required htmlFor="pf-desc">
                <TextArea id="pf-desc" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={4} required />
              </Field>
              <FormGrid>
                <Field label="Categoría" required htmlFor="pf-cat">
                  <SelectInput id="pf-cat" value={formData.categoryId || ''} required
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Selecciona una categoría</option>
                    {availableCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </SelectInput>
                </Field>
                <Field label="Tipo de producto" required htmlFor="pf-type" hint="Define las tallas disponibles.">
                  <SelectInput id="pf-type" value={formData.typeId || ''} required
                    onChange={(e) => setFormData({ ...formData, typeId: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Selecciona un tipo</option>
                    {availableProductTypes
                      .filter(type => !formData.categoryId || type.categoryId === formData.categoryId)
                      .map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </SelectInput>
                </Field>
              </FormGrid>
              <Field label="Etiquetas" htmlFor="pf-tags" hint="Separadas por coma. Ayudan a encontrar el producto.">
                <TextInput id="pf-tags" value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} placeholder="básico, algodón, unisex" />
              </Field>
            </div>
          </Card>

          {/* Imágenes */}
          <Card>
            <CardTitle icon={ImageIcon}>Imágenes</CardTitle>
            <ImageGallery value={images} onChange={setImages} max={MAX_IMAGES} maxSizeMB={5} />
            {images.length === 0 && <p className="text-xs text-gray-400 mt-1">Sin imagen: se mostrará un marcador de posición.</p>}
          </Card>

          {/* Variantes */}
          <Card>
            <CardTitle icon={Layers}>Variantes</CardTitle>
            <Switch
              checked={hasVariants}
              onChange={toggleVariants}
              label="Se vende en colores o tallas"
              description="Actívalo solo si el producto tiene distintos colores o tallas. Si no, se guarda como producto simple (una sola variante)."
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

                {selectedColorIds.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Imagen por color <span className="text-xs font-normal text-gray-500">(opcional)</span></p>
                    <p className="text-xs text-gray-500 mb-3">Al elegir el color en la tienda, el carrito o el POS se muestra esta imagen.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {availableColors.filter(c => selectedColorIds.includes(c.id)).map(color => (
                        <div key={color.id}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="w-3.5 h-3.5 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: color.hexCode }} />
                            <span className="text-xs font-medium text-gray-700 truncate">{color.name}</span>
                          </div>
                          <ImageInput
                            value={colorImages[color.id]}
                            allowUrl={false}
                            onChange={(v) => setColorImages(prev => {
                              const n = { ...prev };
                              if (v) n[color.id] = v; else delete n[color.id];
                              return n;
                            })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {/* Precio */}
          <Card>
            <CardTitle icon={Tag}>Precio</CardTitle>
            <Field label="Precio de venta" required htmlFor="pf-price"
              hint="El stock se maneja por variante (Variantes / Inventario). Los descuentos, en Cupones.">
              <MoneyInput id="pf-price" value={formData.basePrice} onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) })} required />
            </Field>
          </Card>

          {/* Publicación */}
          <Card>
            <CardTitle icon={Star}>Publicación</CardTitle>
            <div className="space-y-4">
              <Switch checked={formData.featured} onChange={(v) => setFormData({ ...formData, featured: v })} label="Destacado" description="Se muestra en las secciones de destacados de la tienda." />
              <FormGrid>
                <Field label="Calificación" htmlFor="pf-rating" hint="De 0 a 5.">
                  <NumberInput id="pf-rating" step="0.1" min="0" max="5" value={formData.rating} onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) })} />
                </Field>
                <Field label="Reseñas" htmlFor="pf-reviews">
                  <NumberInput id="pf-reviews" min="0" step="1" value={formData.reviewsCount} onChange={(e) => setFormData({ ...formData, reviewsCount: parseInt(e.target.value) })} />
                </Field>
              </FormGrid>
            </div>
          </Card>
        </div>
      </div>

      <FormActions sticky>
        {onDelete && (
          <Button variant="danger" className="sm:mr-auto" onClick={onDelete} icon={<Trash2 className="w-4 h-4" />}>Eliminar producto</Button>
        )}
        {onCancel && <Button variant="secondary" onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" isLoading={saving} disabled={missingVariants} icon={<Save className="w-4 h-4" />}>
          {product ? 'Guardar cambios' : 'Crear producto'}
        </Button>
      </FormActions>
    </form>
  );
};
