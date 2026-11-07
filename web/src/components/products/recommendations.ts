import { productsService } from '../../services/products.service';
import type { Product } from '../../types/product';

/**
 * Productos relacionados: los de la lista menos el actual (y las plantillas), primero los que
 * comparten más etiquetas; a igual número, se respeta el orden del API.
 */
export function pickRelated(list: Product[], current: Pick<Product, 'id' | 'tags'>, limit = 12): Product[] {
  const tags = new Set(current.tags ?? []);
  const shared = (p: Product) => (p.tags ?? []).filter((t) => tags.has(t)).length;
  return list
    .filter((p) => p.id !== current.id && !p.isTemplate)
    .map((p, i) => ({ p, i, score: shared(p) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.p);
}

/** Quita de una lista los productos que ya están en el carrito. */
export function excludeIds(list: Product[], ids: Iterable<number>, limit = 12): Product[] {
  const skip = new Set(ids);
  return list.filter((p) => !skip.has(p.id) && !p.isTemplate).slice(0, limit);
}

/** Clave de caché y cargador de los productos de una categoría (relacionados). */
export const relatedKey = (categorySlug?: string) => (categorySlug ? `related:${categorySlug}` : null);
export const fetchCategoryProducts = (categorySlug: string) => () =>
  productsService.getAll({ category: categorySlug, isActive: true, limit: 16 }).then((r) => r.data || []);
