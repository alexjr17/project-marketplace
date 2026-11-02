import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { useCurrency } from '../../hooks/useCurrency';
import type { Product } from '../../types/product';
import { FavoriteButton } from './FavoriteButton';
import { Badge } from '../ui';

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

/** Tarjeta de producto de la tienda: blanca, borde gris, imagen cuadrada y solo sombra al pasar. */
export const ProductCard = ({ product, priority = false }: ProductCardProps) => {
  const { format } = useCurrency();
  const inStock = (product.stock ?? 0) > 0;
  const onSale = product.hasDiscount && product.salePrice != null;
  const sizes = product.sizes.map((size) => (typeof size === 'string' ? size : size.abbreviation));

  return (
    <Link
      to={`/product/${product.id}`}
      className="group bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow overflow-hidden flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500"
    >
      {/* Imagen (proporción fija) */}
      <div className="relative aspect-square bg-gray-100">
        <img
          src={sizedImage(product.images.front, 400)}
          alt={product.name}
          loading={priority ? 'eager' : 'lazy'}
          // @ts-expect-error fetchpriority es válido en HTML pero falta en los tipos de React
          fetchpriority={priority ? 'high' : 'auto'}
          decoding="async"
          width={400}
          height={400}
          className={`w-full h-full object-cover ${inStock ? '' : 'opacity-60'}`}
        />
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {onSale && (
            <Badge tone="green" className="shadow-sm">
              {product.discountType === 'percent' && product.discountValue ? `-${Math.round(product.discountValue)}%` : 'Oferta'}
            </Badge>
          )}
          {product.featured && <Badge tone="app" className="shadow-sm">Destacado</Badge>}
          {!inStock && <Badge tone="red" className="shadow-sm">Agotado</Badge>}
        </div>
        <FavoriteButton
          productId={Number(product.id)}
          size={16}
          className="absolute top-2 right-2 w-8 h-8 bg-white/95 hover:bg-white border border-gray-200"
        />
      </div>

      {/* Datos */}
      <div className="p-3 sm:p-4 flex flex-col gap-1.5 flex-1">
        <span className="text-[11px] font-medium tracking-wide text-gray-500 uppercase truncate">
          {categoryLabels[product.category] || product.category}
        </span>

        <h3 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>

        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Star className={`w-3.5 h-3.5 ${(product.rating || 0) > 0 ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}`} />
          <span className="font-medium text-gray-700">{Number(product.rating || 0).toFixed(1)}</span>
          <span>({product.reviewsCount || 0})</span>
          {inStock && <span className="ml-auto text-green-700 whitespace-nowrap">{product.stock} disp.</span>}
        </div>

        {(product.colors.length > 0 || sizes.length > 0) && (
          <div className="flex items-center gap-2 min-w-0">
            {product.colors.length > 0 && (
              <div className="flex items-center -space-x-1 flex-shrink-0">
                {product.colors.slice(0, 4).map((color, idx) => (
                  <span
                    key={idx}
                    className="w-4 h-4 rounded-full border-2 border-white ring-1 ring-gray-200"
                    style={{ backgroundColor: color.hexCode }}
                    title={color.name}
                  />
                ))}
              </div>
            )}
            {product.colors.length > 4 && <span className="text-xs text-gray-400">+{product.colors.length - 4}</span>}
            {sizes.length > 0 && (
              <span className="text-xs text-gray-400 truncate">
                {sizes.slice(0, 5).join(' · ')}{sizes.length > 5 ? ` +${sizes.length - 5}` : ''}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto pt-1 flex items-baseline gap-2 flex-wrap">
          {onSale ? (
            <>
              <span className="text-base font-semibold text-gray-900">{format(product.salePrice!)}</span>
              <span className="text-xs text-gray-400 line-through">{format(product.basePrice)}</span>
            </>
          ) : (
            <span className="text-base font-semibold text-gray-900">{format(product.basePrice)}</span>
          )}
        </div>
      </div>
    </Link>
  );
};
