import { Link } from 'react-router-dom';
import { useCurrency } from '../../../hooks/useCurrency';
import type { Product } from '../../../types/product';
import { FavoriteButton } from '../../products/FavoriteButton';
import { ProductImage } from '../../products/ProductImage';

/**
 * Tarjeta de producto de la portada: foto grande 4:5 sin marco; al pasar el mouse muestra la
 * espalda de la prenda si la tiene. Precio con oferta y favorito.
 */
export function StoreCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const { format } = useCurrency();
  const sale = product.hasDiscount && product.salePrice != null ? product.salePrice : null;
  const pct = sale != null && product.basePrice > 0 ? Math.round(((product.basePrice - sale) / product.basePrice) * 100) : 0;
  const back = product.images.back;
  const inStock = (product.stock ?? 0) > 0;

  return (
    <div className="group relative">
      <Link to={`/product/${product.id}`} className="block rounded-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-app-200">
        <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-white">
          <div className={`absolute inset-0 transition-opacity duration-500 ${back ? 'group-hover:opacity-0' : ''}`}>
            <ProductImage src={product.images.front} alt={product.name} width={600} priority={priority} className={inStock ? '' : 'opacity-60'} />
          </div>
          {back && (
            <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden="true">
              <ProductImage src={back} alt="" width={600} />
            </div>
          )}
          <div className="absolute left-3 top-3 flex gap-1.5">
            {pct > 0 && <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-ink">-{pct}%</span>}
            {!inStock && <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-gray-700">Agotado</span>}
          </div>
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-gray-900 leading-snug line-clamp-2">{product.name}</h3>
            {product.categoryName && <p className="text-sm text-gray-500 truncate">{product.categoryName}</p>}
          </div>
          <p className="text-right flex-shrink-0">
            <span className="block text-[15px] font-semibold text-gray-900 tabular-nums">{format(sale ?? product.basePrice)}</span>
            {sale != null && (
              <span className="block text-sm text-gray-500 line-through tabular-nums"><span className="sr-only">Antes: </span>{format(product.basePrice)}</span>
            )}
          </p>
        </div>
      </Link>
      <FavoriteButton
        productId={Number(product.id)}
        size={16}
        className="absolute top-3 right-3 w-10 h-10 bg-white/90 hover:bg-white backdrop-blur shadow-sm"
      />
    </div>
  );
}
