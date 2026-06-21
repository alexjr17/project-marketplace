import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { useCurrency } from '../../hooks/useCurrency';
import type { Product } from '../../types/product';

interface ProductCardProps {
  product: Product;
  /** Imágenes "above the fold" (primeras del grid): cargan con prioridad para mejorar el LCP. */
  priority?: boolean;
}

const categoryLabels: Record<string, string> = {
  clothing: 'Ropa',
  accessories: 'Accesorios',
  drinkware: 'Bebidas',
  home: 'Hogar',
  office: 'Oficina',
};

// Para imágenes servidas por nuestro endpoint, pide un ancho acorde a la card.
function sizedImage(url: string | undefined, w: number): string {
  if (!url || !url.includes('/api/img/')) return url || '';
  return url + (url.includes('?') ? '&' : '?') + 'w=' + w;
}

export const ProductCard = ({ product, priority = false }: ProductCardProps) => {
  const { format } = useCurrency();

  return (
    <Link
      to={`/product/${product.id}`}
      className="group bg-white rounded-xl hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col"
    >
      {/* Image */}
      <div className="relative overflow-hidden aspect-square bg-gray-100">
        <img
          src={sizedImage(product.images.front, 400)}
          alt={product.name}
          loading={priority ? 'eager' : 'lazy'}
          // @ts-expect-error fetchpriority es válido en HTML pero falta en los tipos de React
          fetchpriority={priority ? 'high' : 'auto'}
          decoding="async"
          width={400}
          height={400}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {product.featured && (
          <span className="absolute top-2 left-2 bg-gray-900 text-white text-[10px] font-bold px-2 py-0.5 rounded">
            DESTACADO
          </span>
        )}
        {/* Disponibilidad (un solo lugar: sobre la imagen) */}
        {(product.stock ?? 0) > 0 ? (
          <span className="absolute top-2 right-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
            {product.stock} disp.
          </span>
        ) : (
          <span className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
            AGOTADO
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1">
        {/* Categoría */}
        <span className="text-xs text-gray-500 uppercase">
          {categoryLabels[product.category] || product.category}
        </span>

        {/* Nombre */}
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
          {product.name}
        </h3>

        {/* Rating */}
        <div className="flex items-center gap-1">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                className={`w-3 h-3 ${
                  index < Math.round(product.rating || 0)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-gray-200 text-gray-200'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500">
            ({product.reviewsCount || 0})
          </span>
        </div>

        {/* Colores */}
        <div className="flex items-center gap-1">
          {product.colors.slice(0, 4).map((color, idx) => (
            <div
              key={idx}
              className="w-4 h-4 rounded-full border border-gray-200"
              style={{ backgroundColor: color.hexCode }}
              title={color.name}
            />
          ))}
          {product.colors.length > 4 && (
            <span className="text-xs text-gray-400">+{product.colors.length - 4}</span>
          )}
        </div>

        {/* Tallas */}
        <div className="flex items-center gap-1 flex-wrap">
          {product.sizes.slice(0, 5).map((size, idx) => {
            const sizeValue = typeof size === 'string' ? size : size.abbreviation;
            return (
              <span key={idx} className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                {sizeValue}
              </span>
            );
          })}
          {product.sizes.length > 5 && (
            <span className="text-xs text-gray-400">+{product.sizes.length - 5}</span>
          )}
        </div>

        {/* Precio */}
        <span className="text-base font-bold text-gray-900 mt-1">
          {format(product.basePrice)}
        </span>
      </div>
    </Link>
  );
};
