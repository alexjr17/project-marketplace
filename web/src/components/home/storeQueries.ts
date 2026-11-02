import { productsService, type ProductFilters } from '../../services/products.service';

/** Pestañas de la vitrina de la portada. */
export type ShowcaseTab = 'new' | 'top' | 'sale';

const LIMIT = 10;

/** Filtros de cada pestaña de la vitrina. */
export const SHOWCASE_QUERIES: Record<ShowcaseTab, ProductFilters> = {
  new: { limit: LIMIT, isActive: true, sortBy: 'createdAt', sortOrder: 'desc' },
  top: { limit: LIMIT, isActive: true, sortBy: 'rating', sortOrder: 'desc' },
  sale: { limit: LIMIT, isActive: true, onSale: true, sortBy: 'createdAt', sortOrder: 'desc' },
};

/**
 * Cargador de cada pestaña (clave de caché `showcase:<tab>`). Lo comparten la vitrina y el hero,
 * así la portada pide Novedades y Ofertas una sola vez.
 */
export const fetchShowcase = (tab: ShowcaseTab) => () =>
  productsService.getAll(SHOWCASE_QUERIES[tab]).then((r) => r.data || []);
