import { useState, useEffect } from 'react';
import type { Product, ProductType, ProductCategory } from '../../types/product';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { ImageUploadField } from './ImageUploadField';
import { X } from 'lucide-react';
import { catalogsService } from '../../services/catalogs.service';
import type { Color, Size, Category, ProductType as CatalogProductType } from '../../services/catalogs.service';

const MAX_IMAGES = 5;

// Helper para obtener imágenes del producto (array plano)
function getProductImages(product?: Product): string[] {
  if (!product?.images) return [];
  // Si images es un array, usarlo directamente
  if (Array.isArray(product.images)) return product.images.filter(Boolean);
  // Si es objeto con front/back/side, convertirlo a array
  const imgs = product.images as { front?: string; back?: string; side?: string };
  return [imgs.front, imgs.back, imgs.side].filter((img): img is string => !!img);
}

interface ProductFormProps {
  product?: Product;
  onSubmit: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: () => void;
}

export const ProductForm = ({ product, onSubmit, onDelete }: ProductFormProps) => {
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

  // Imágenes (nuevo sistema de array)
  const [images, setImages] = useState<string[]>(getProductImages(product));

  // Drag & Drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Catálogos disponibles
  const [availableColors, setAvailableColors] = useState<Color[]>([]);
  const [availableSizes, setAvailableSizes] = useState<Size[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [availableProductTypes, setAvailableProductTypes] = useState<CatalogProductType[]>([]);

  // IDs seleccionados
  const [selectedColorIds, setSelectedColorIds] = useState<number[]>(
    product?.colors?.map(c => c.id) || []
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

  // Funciones para manejar imágenes
  const addImage = (imageUrl: string) => {
    if (imageUrl && images.length < MAX_IMAGES) {
      setImages([...images, imageUrl]);
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
  };

  // Drag & Drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newImages = [...images];
    const [draggedImage] = newImages.splice(draggedIndex, 1);
    newImages.splice(dropIndex, 0, draggedImage);

    setImages(newImages);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Convertir IDs a objetos completos para el backend.
    // Si el producto es simple (sin variantes), se envían color/tallas vacíos.
    const selectedColors = hasVariants ? availableColors.filter(c => selectedColorIds.includes(c.id)) : [];
    const selectedSizes = hasVariants ? availableSizes.filter(s => selectedSizeIds.includes(s.id)) : [];

    const productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
      name: formData.name,
      description: formData.description,
      typeId: formData.typeId,
      categoryId: formData.categoryId,
      basePrice: Number(formData.basePrice),
      stock: Number(formData.stock),
      featured: formData.featured,
      rating: formData.rating || undefined,
      reviewsCount: formData.reviewsCount || undefined,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      images: images.filter(Boolean),
      colors: selectedColors.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        hexCode: c.hexCode,
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
    setSelectedColorIds(prev =>
      prev.includes(colorId)
        ? prev.filter(id => id !== colorId)
        : [...prev, colorId]
    );
  };

  const toggleSize = (sizeId: number) => {
    setSelectedSizeIds(prev =>
      prev.includes(sizeId)
        ? prev.filter(id => id !== sizeId)
        : [...prev, sizeId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-12 gap-3">
        {/* Primera fila: Nombre completo */}
        <div className="col-span-12">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre del Producto *
          </label>
          <Input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        {/* Segunda fila: Descripción completa */}
        <div className="col-span-12">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            rows={3}
            required
          />
        </div>

        {/* Tercera fila: Categoría, Tipo, Precio */}
        <div className="col-span-12 md:col-span-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Categoría *
          </label>
          <select
            value={formData.categoryId || ''}
            onChange={(e) => setFormData({ ...formData, categoryId: e.target.value ? Number(e.target.value) : null })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            required
          >
            <option value="">Selecciona una categoría</option>
            {availableCategories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-12 md:col-span-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de Producto *
          </label>
          <select
            value={formData.typeId || ''}
            onChange={(e) => setFormData({ ...formData, typeId: e.target.value ? Number(e.target.value) : null })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            required
          >
            <option value="">Selecciona un tipo</option>
            {availableProductTypes
              .filter(type => !formData.categoryId || type.categoryId === formData.categoryId)
              .map(type => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
          </select>
        </div>

        <div className="col-span-12 md:col-span-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Precio ($) *
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.basePrice}
            onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) })}
            required
          />
        </div>

        {/* El stock se administra por variante (módulo Variantes/Inventario),
            no en el producto: por eso aquí no se edita. */}

        {/* Imágenes del Producto */}
        <div className="col-span-12">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Imágenes del Producto (opcional, máximo {MAX_IMAGES})
          </label>

          {/* Galería de imágenes existentes - arrastrables */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-4">
              {images.map((img, index) => (
                <div
                  key={index}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`relative group aspect-square cursor-grab active:cursor-grabbing transition-all duration-200 ${
                    draggedIndex === index ? 'opacity-50 scale-95' : ''
                  } ${
                    dragOverIndex === index ? 'ring-2 ring-orange-500 ring-offset-2' : ''
                  }`}
                >
                  <img
                    src={img}
                    alt={`Imagen ${index + 1}`}
                    className="w-full h-full object-contain bg-gray-50 rounded-lg border-2 border-gray-200 p-2 pointer-events-none"
                  />
                  {/* Indicador de arrastre */}
                  <div className="absolute top-2 left-2 p-1 bg-gray-800/70 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                    title="Eliminar imagen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  {index === 0 && (
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-orange-500 text-white text-xs font-medium rounded shadow">
                      Principal
                    </span>
                  )}
                  {/* Número de orden */}
                  <span className="absolute bottom-2 right-2 w-6 h-6 flex items-center justify-center bg-gray-800/70 text-white text-xs font-bold rounded-full">
                    {index + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          {images.length > 1 && (
            <p className="text-xs text-gray-500 mb-3">
              💡 Arrastra las imágenes para cambiar el orden. La primera será la principal.
            </p>
          )}

          {/* Agregar nueva imagen (si no se alcanzó el límite) */}
          {images.length < MAX_IMAGES ? (
            <ImageUploadField
              key={`image-upload-${images.length}`}
              label={`Agregar imagen (${images.length}/${MAX_IMAGES})`}
              value=""
              onChange={(value) => {
                if (value) addImage(value);
              }}
            />
          ) : (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <p className="text-sm text-green-700 font-medium">
                ✓ Máximo de {MAX_IMAGES} imágenes alcanzado
              </p>
            </div>
          )}

          {images.length === 0 && (
            <p className="text-xs text-gray-400 mt-1">Sin imagen: se mostrará un marcador de posición.</p>
          )}
        </div>

        {/* Rating, Reviews, Tags, Destacado */}
        <div className="col-span-12 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rating (0-5)
          </label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="5"
            value={formData.rating}
            onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) })}
          />
        </div>

        <div className="col-span-12 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reseñas
          </label>
          <Input
            type="number"
            min="0"
            value={formData.reviewsCount}
            onChange={(e) => setFormData({ ...formData, reviewsCount: parseInt(e.target.value) })}
          />
        </div>

        <div className="col-span-12 md:col-span-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags (separados por coma)
          </label>
          <Input
            type="text"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="básico, algodón, unisex"
          />
        </div>

        <div className="col-span-12 md:col-span-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            &nbsp;
          </label>
          <label className="flex items-center space-x-2 h-10 px-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              checked={formData.featured}
              onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
              className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
            />
            <span className="text-sm font-medium text-gray-700">Destacado</span>
          </label>
        </div>

        {/* Toggle de variantes (color y talla) */}
        <div className="col-span-12">
          <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Variantes (color y talla)</p>
              <p className="text-xs text-gray-500">
                Actívalo solo si el producto se vende en distintos colores o tallas. Si no, se guarda como producto simple.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !hasVariants;
                if (!next) {
                  // Apagar variantes en un producto que YA tenía color/talla puede
                  // afectar variantes con stock/ventas: pedir confirmación.
                  const hadVariants = (product?.colors?.length ?? 0) > 0 ||
                    (Array.isArray(product?.sizes) && product.sizes.length > 0);
                  if (hadVariants) {
                    const stockNote = (product?.stock ?? 0) > 0 ? ` El producto tiene stock (${product?.stock}).` : '';
                    const ok = window.confirm(
                      `Este producto tiene variantes de color/talla.${stockNote}\n\n` +
                      'Si lo conviertes en producto simple, esas variantes dejarán de usarse y el inventario pasará a una sola variante. ' +
                      'Esto puede afectar el stock y los reportes.\n\n¿Continuar?'
                    );
                    if (!ok) return;
                  }
                  setSelectedColorIds([]);
                  setSelectedSizeIds([]);
                }
                setHasVariants(next);
              }}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${hasVariants ? 'bg-orange-500' : 'bg-gray-300'}`}
              aria-pressed={hasVariants}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${hasVariants ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {hasVariants && (
        <>
        {/* Colores (selector con checkboxes) */}
        <div className="col-span-12 md:col-span-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Colores (selecciona al menos uno)
          </label>
          <div className="border border-gray-300 rounded-lg p-3 bg-gray-50 max-h-64 overflow-y-auto">
            {availableColors.length === 0 ? (
              <p className="text-sm text-gray-500">Cargando colores...</p>
            ) : (
              <div className="space-y-2">
                {availableColors.map(color => (
                  <label
                    key={color.id}
                    className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedColorIds.includes(color.id)}
                      onChange={() => toggleColor(color.id)}
                      className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <div
                      className="w-8 h-8 rounded border border-gray-300 flex-shrink-0"
                      style={{ backgroundColor: color.hexCode }}
                      title={color.hexCode}
                    />
                    <span className="text-sm font-medium text-gray-700 flex-1">
                      {color.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {selectedColorIds.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {selectedColorIds.length} color{selectedColorIds.length !== 1 ? 'es' : ''} seleccionado{selectedColorIds.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Tallas (selector con checkboxes) */}
        <div className="col-span-12 md:col-span-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Tallas (selecciona al menos una)
          </label>
          <div className="border border-gray-300 rounded-lg p-3 bg-gray-50 max-h-64 overflow-y-auto">
            {!formData.typeId ? (
              <p className="text-sm text-gray-500">Selecciona un tipo de producto primero para ver las tallas disponibles</p>
            ) : availableSizes.length === 0 ? (
              <p className="text-sm text-gray-500">No hay tallas asignadas a este tipo de producto</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {availableSizes.map(size => (
                  <label
                    key={size.id}
                    className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSizeIds.includes(size.id)}
                      onChange={() => toggleSize(size.id)}
                      className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {size.abbreviation} <span className="text-xs text-gray-500">({size.name})</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {selectedSizeIds.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {selectedSizeIds.length} talla{selectedSizeIds.length !== 1 ? 's' : ''} seleccionada{selectedSizeIds.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        </>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-12 gap-3 pt-6 mt-6 border-t border-gray-200">
        {onDelete ? (
          <>
            <div className="col-span-12 sm:col-span-6">
              <Button
                type="button"
                onClick={onDelete}
                variant="admin-danger"
                className="w-full"
              >
                Eliminar Producto
              </Button>
            </div>
            <div className="col-span-12 sm:col-span-6">
              <Button
                type="submit"
                variant="admin-primary"
                className="w-full"
                disabled={hasVariants && (selectedColorIds.length === 0 || selectedSizeIds.length === 0)}
              >
                Actualizar Producto
              </Button>
            </div>
          </>
        ) : (
          <div className="col-span-12">
            <Button
              type="submit"
              variant="admin-primary"
              className="w-full"
              disabled={hasVariants && (selectedColorIds.length === 0 || selectedSizeIds.length === 0)}
            >
              Crear Producto
            </Button>
          </div>
        )}
      </div>
    </form>
  );
};
