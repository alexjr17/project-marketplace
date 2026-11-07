import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { useCurrency } from '../../hooks/useCurrency';
import type { Product } from '../../types/product';
import { FavoriteButton } from './FavoriteButton';
import { ProductImage } from './ProductImage';
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

/** % de descuento real entre el precio base y el de venta (redondeado). */
function discountPercent(base: number, sale: number): number {
  if (!base || sale >= base) return 0;
  return Math.round(((base - sale) / base) * 100);
}

/**
 * Tarjeta de producto de la tienda: blanca, borde gris, imagen cuadrada y solo sombra al pasar.
 * Precio con descuento (tachado y %), calificación, agotado y favorito.
 */
export const ProductCard = ({ product, priority = false }: ProductCardProps) => {
  const { format } = useCurrency();
  const inStock = (product.stock ?? 0) > 0;
  const lowStock = inStock && (product.stock ?? 0) <= 3;
  const sale = product.hasDiscount && product.salePrice != null ? product.salePrice : null;
  const pct = sale != null ? discountPercent(product.basePrice, sale) : 0;
  const reviews = product.reviewsCount || 0;
  const rating = Number(product.rating || 0);
  const sizes = product.sizes.map((size) => (typeof size === 'string' ? size : size.abbreviation));
  const categoryLabel = product.categoryName || (product.category && categoryLabels[product.category]) || product.category;

  return (
    <Link
      to={`/product/${product.id}`}
      className="group bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500"
    >
      {/* Imagen (proporción fija; respaldo limpio si falla) */}
      <div className="relative aspect-square bg-gray-100 overflow-hidden">
        <ProductImage
          src={product.images.front}
          alt={product.name}
          priority={priority}
          className={inStock ? '' : 'opacity-60'}
        />
        <div className="absolute top-2 left-2 right-12 flex flex-wrap items-start gap-1 pointer-events-none">
          {sale != null && (
            <Badge tone="green" className="shadow-sm ring-1 ring-white/70">{pct > 0 ? `-${pct}%` : 'Oferta'}</Badge>
          )}
          {product.featured && <Badge tone="app" className="shadow-sm ring-1 ring-white/70">Destacado</Badge>}
          {!inStock && <Badge tone="red" className="shadow-sm ring-1 ring-white/70">Agotado</Badge>}
        </div>
        <FavoriteButton
          productId={Number(product.id)}
          size={16}
          className="absolute top-2 right-2 w-8 h-8 bg-white/95 hover:bg-white border border-gray-200 shadow-sm"
        />
      </div>

      {/* Datos */}
      <div className="p-3 sm:p-4 flex flex-col gap-1.5 flex-1 min-w-0">
        {categoryLabel && (
          <span className="text-[11px] font-medium tracking-wide text-gray-500 uppercase truncate">{categoryLabel}</span>
        )}

        <h3 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>

        <div className="flex items-center gap-1 text-xs text-gray-500 min-h-[1rem]">
          {reviews > 0 ? (
            <>
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-medium text-gray-700">{rating.toFixed(1)}</span>
              <span>({reviews})</span>
            </>
          ) : (
            <span className="text-gray-400">Sin reseñas</span>
          )}
          {lowStock && <span className="ml-auto text-amber-700 whitespace-nowrap">Últimas {product.stock}</span>}
        </div>

        {(product.colors.length > 0 || sizes.length > 0) && (
          <div className="hidden sm:flex items-center gap-2 min-w-0">
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

        <div className="mt-auto pt-1 flex items-baseline gap-x-2 flex-wrap">
          <span className="text-base font-semibold text-gray-900">{format(sale ?? product.basePrice)}</span>
          {sale != null && (
            <span className="text-xs text-gray-400 line-through">{format(product.basePrice)}</span>
          )}
        </div>
      </div>
    </Link>
  );
};
