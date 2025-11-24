import { useState } from 'react';
import type { Product, ProductType, ProductCategory, ProductColor } from '../../types/product';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { X, Plus } from 'lucide-react';

interface ProductFormProps {
  product?: Product;
  onSubmit: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: () => void;
}

const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: 'tshirt', label: 'Camiseta' },
  { value: 'hoodie', label: 'Hoodie' },
  { value: 'cap', label: 'Gorra' },
  { value: 'bottle', label: 'Botella' },
  { value: 'mug', label: 'Taza' },
  { value: 'pillow', label: 'Almohada' },
];

const CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: 'clothing', label: 'Ropa' },
  { value: 'accessories', label: 'Accesorios' },
  { value: 'home', label: 'Hogar' },
];

export const ProductForm = ({ product, onSubmit, onDelete }: ProductFormProps) => {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    type: product?.type || 'tshirt' as ProductType,
    category: product?.category || 'clothing' as ProductCategory,
    basePrice: product?.basePrice || 0,
    stock: product?.stock || 0,
    featured: product?.featured || false,
    rating: product?.rating || 0,
    reviewsCount: product?.reviewsCount || 0,
    tags: product?.tags?.join(', ') || '',
    frontImage: product?.images.front || '',
    backImage: product?.images.back || '',
    sideImage: product?.images.side || '',
  });

  const [colors, setColors] = useState<ProductColor[]>(
    product?.colors || [{ name: '', hex: '#000000' }]
  );

  const [sizes, setSizes] = useState<string[]>(
    product?.sizes || []
  );

  const [newSize, setNewSize] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
      name: formData.name,
      description: formData.description,
      type: formData.type,
      category: formData.category,
      basePrice: Number(formData.basePrice),
      stock: Number(formData.stock),
      featured: formData.featured,
      rating: formData.rating || undefined,
      reviewsCount: formData.reviewsCount || undefined,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      images: {
        front: formData.frontImage,
        back: formData.backImage || undefined,
        side: formData.sideImage || undefined,
      },
      colors,
      sizes,
    };

    onSubmit(productData);
  };

  const addColor = () => {
    setColors([...colors, { name: '', hex: '#000000' }]);
  };

  const updateColor = (index: number, field: 'name' | 'hex', value: string) => {
    const updated = [...colors];
    updated[index] = { ...updated[index], [field]: value };
    setColors(updated);
  };

  const removeColor = (index: number) => {
    setColors(colors.filter((_, i) => i !== index));
  };

  const addSize = () => {
    if (newSize && !sizes.includes(newSize)) {
      setSizes([...sizes, newSize]);
      setNewSize('');
    }
  };

  const removeSize = (size: string) => {
    setSizes(sizes.filter(s => s !== size));
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

        {/* Tercera fila: Tipo, Categoría, Precio, Stock */}
        <div className="col-span-12 md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo *
          </label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as ProductType })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            required
          >
            {PRODUCT_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-12 md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Categoría *
          </label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as ProductCategory })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            required
          >
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-12 md:col-span-3">
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

        <div className="col-span-12 md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stock *
          </label>
          <Input
            type="number"
            min="0"
            value={formData.stock}
            onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
            required
          />
        </div>

        {/* Cuarta fila: Imagen Frontal completa */}
        <div className="col-span-12">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Imagen Frontal (URL) *
          </label>
          <Input
            type="url"
            value={formData.frontImage}
            onChange={(e) => setFormData({ ...formData, frontImage: e.target.value })}
            required
            placeholder="https://ejemplo.com/imagen-frontal.jpg"
          />
        </div>

        {/* Quinta fila: Imágenes Trasera y Lateral */}
        <div className="col-span-12 md:col-span-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Imagen Trasera (URL)
          </label>
          <Input
            type="url"
            value={formData.backImage}
            onChange={(e) => setFormData({ ...formData, backImage: e.target.value })}
            placeholder="https://ejemplo.com/imagen-trasera.jpg"
          />
        </div>

        <div className="col-span-12 md:col-span-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Imagen Lateral (URL)
          </label>
          <Input
            type="url"
            value={formData.sideImage}
            onChange={(e) => setFormData({ ...formData, sideImage: e.target.value })}
            placeholder="https://ejemplo.com/imagen-lateral.jpg"
          />
        </div>

        {/* Sexta fila: Rating, Reviews, Tags, Destacado */}
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

        <div className="col-span-12 md:col-span-3">
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

        {/* Séptima fila: Colores y Tallas */}
        <div className="col-span-12 md:col-span-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Colores *
          </label>
          <div className="space-y-2">
            {colors.map((color, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Nombre"
                  value={color.name}
                  onChange={(e) => updateColor(index, 'name', e.target.value)}
                  className="flex-1"
                  required
                />
                <input
                  type="color"
                  value={color.hex}
                  onChange={(e) => updateColor(index, 'hex', e.target.value)}
                  className="w-14 h-9 border border-gray-300 rounded cursor-pointer"
                />
                {colors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeColor(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="admin-secondary"
              size="sm"
              onClick={addColor}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar
            </Button>
          </div>
        </div>

        <div className="col-span-12 md:col-span-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Tallas *
          </label>
          <div className="flex flex-wrap gap-2 mb-2 min-h-[36px] p-2 bg-gray-50 rounded-lg">
            {sizes.map((size) => (
              <span
                key={size}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 text-gray-700 rounded-full text-sm"
              >
                {size}
                <button
                  type="button"
                  onClick={() => removeSize(size)}
                  className="text-gray-500 hover:text-red-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Nueva talla"
              value={newSize}
              onChange={(e) => setNewSize(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSize();
                }
              }}
            />
            <Button
              type="button"
              variant="admin-secondary"
              onClick={addSize}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
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
            >
              Crear Producto
            </Button>
          </div>
        )}
      </div>
    </form>
  );
};
