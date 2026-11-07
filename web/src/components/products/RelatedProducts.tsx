import { useMemo } from 'react';
import { useStoreData } from '../../hooks/useStoreData';
import { fetchShowcase } from '../home/storeQueries';
import { ProductRail } from './ProductRail';
import { excludeIds, fetchCategoryProducts, pickRelated, relatedKey } from './recommendations';
import type { Product } from '../../types/product';

/**
 * Productos de la misma categoría (sin el actual), en una fila deslizable. Si la categoría
 * no tiene otros, muestra los más valorados de la tienda (misma caché que la portada).
 */
export function RelatedProducts({ product, limit = 12 }: { product: Product; limit?: number }) {
  const slug = product.categorySlug || (typeof product.category === 'string' ? product.category : undefined);
  const related = useStoreData(relatedKey(slug), fetchCategoryProducts(slug || ''));
  const sameCategory = useMemo(() => pickRelated(related.data ?? [], product, limit), [related.data, product, limit]);

  const needFallback = !related.loading && sameCategory.length === 0;
  const top = useStoreData(needFallback ? 'showcase:top' : null, fetchShowcase('top'));
  const fallback = useMemo(() => excludeIds(top.data ?? [], [product.id], limit), [top.data, product.id, limit]);

  return needFallback ? (
    <ProductRail title="Lo más valorado" products={fallback} loading={top.loading} viewAllTo="/catalog?sort=rating" />
  ) : (
    <ProductRail
      title="También te puede gustar"
      products={sameCategory}
      loading={related.loading}
      viewAllTo={slug ? `/catalog?category=${encodeURIComponent(slug)}` : '/catalog'}
    />
  );
}
