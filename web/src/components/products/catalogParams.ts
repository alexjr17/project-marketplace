import type { FilterValues } from './ProductFilters';
import type { ProductCategory, ProductSortOption, ProductTypeSlug } from '../../types/product';

/**
 * Estado del catálogo ↔ parámetros de la URL. La URL manda: así una búsqueda o un filtro
 * se puede compartir o guardar, y "atrás" del navegador deshace el último cambio.
 *
 *   ?search=buso&category=ropa&type=hoodie&minPrice=20000&maxPrice=90000
 *    &inStock=1&featured=1&onSale=1&tag=anime&sort=price-asc&page=2
 */
export interface CatalogState {
  filters: FilterValues;
  sort: ProductSortOption;
  page: number;
}

export const DEFAULT_SORT: ProductSortOption = 'newest';

const SORTS: ProductSortOption[] = ['newest', 'price-asc', 'price-desc', 'name-asc', 'name-desc', 'rating', 'popular'];

// Alias de enlaces viejos (portada, secciones): ?sort=price, ?sort=reviewsCount…
const SORT_ALIASES: Record<string, ProductSortOption> = {
  price: 'price-asc',
  reviewsCount: 'popular',
  bestsellers: 'popular',
};

const isOn = (v: string | null) => v === '1' || v === 'true';

function toAmount(v: string | null): number | undefined {
  if (v == null || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}

export function readCatalogParams(params: URLSearchParams): CatalogState {
  const filters: FilterValues = {};
  const search = params.get('search')?.trim();
  if (search) filters.search = search;
  const category = params.get('category');
  if (category) filters.category = category as ProductCategory;
  const type = params.get('type');
  if (type) filters.type = type as ProductTypeSlug;
  const minPrice = toAmount(params.get('minPrice'));
  const maxPrice = toAmount(params.get('maxPrice'));
  if (minPrice !== undefined) filters.minPrice = minPrice;
  if (maxPrice !== undefined) filters.maxPrice = maxPrice;
  if (isOn(params.get('inStock'))) filters.inStock = true;
  if (isOn(params.get('featured'))) filters.featured = true;
  if (isOn(params.get('onSale'))) filters.onSale = true;
  const tag = params.get('tag')?.trim();
  if (tag) filters.tag = tag;

  const rawSort = params.get('sort') ?? '';
  let sort: ProductSortOption = SORTS.includes(rawSort as ProductSortOption)
    ? (rawSort as ProductSortOption)
    : SORT_ALIASES[rawSort] ?? DEFAULT_SORT;
  // Enlaces viejos de "Más vendidos" / "Novedades" se traducen a un orden.
  if (!rawSort && isOn(params.get('bestsellers'))) sort = 'popular';
  if (!rawSort && isOn(params.get('newArrivals'))) sort = 'newest';

  const page = Math.max(1, Math.floor(Number(params.get('page')) || 1));
  return { filters, sort, page };
}

/** Parámetros de la URL para un estado (sin los valores por defecto, para URLs cortas). */
export function writeCatalogParams({ filters, sort, page }: CatalogState): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.search?.trim()) p.set('search', filters.search.trim());
  if (filters.category) p.set('category', filters.category);
  if (filters.type) p.set('type', filters.type);
  if (filters.minPrice != null) p.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice != null) p.set('maxPrice', String(filters.maxPrice));
  if (filters.inStock) p.set('inStock', '1');
  if (filters.featured) p.set('featured', '1');
  if (filters.onSale) p.set('onSale', '1');
  if (filters.tag) p.set('tag', filters.tag);
  if (sort !== DEFAULT_SORT) p.set('sort', sort);
  if (page > 1) p.set('page', String(page));
  return p;
}

/** Filtros que manda el API (sin claves vacías: así dos estados iguales comparan igual). */
export function compactFilters(filters: FilterValues): FilterValues {
  const out: FilterValues = {};
  (Object.keys(filters) as (keyof FilterValues)[]).forEach((k) => {
    const v = filters[k];
    if (v === undefined || v === null || v === '' || v === false) return;
    (out as Record<string, unknown>)[k] = v;
  });
  return out;
}

export type ChipKey = 'search' | 'category' | 'type' | 'price' | 'inStock' | 'featured' | 'onSale' | 'tag';

export interface ActiveChip {
  key: ChipKey;
  label: string;
}

/** Nombre visible de una temática: "dragon ball" → "Dragon Ball". */
export const tagLabel = (tag: string) => tag.trim().toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/** Filtros activos como "chips" (para mostrarlos y quitarlos uno a uno). */
export function activeChips(
  filters: FilterValues,
  names: { category?: (slug: string) => string | undefined; type?: (slug: string) => string | undefined },
  formatMoney: (n: number) => string,
): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (filters.search) chips.push({ key: 'search', label: `«${filters.search}»` });
  if (filters.tag) chips.push({ key: 'tag', label: tagLabel(filters.tag) });
  if (filters.category) chips.push({ key: 'category', label: names.category?.(filters.category) ?? filters.category });
  if (filters.type) chips.push({ key: 'type', label: names.type?.(filters.type) ?? filters.type });
  if (filters.minPrice != null || filters.maxPrice != null) {
    const { minPrice: min, maxPrice: max } = filters;
    const label = min != null && max != null
      ? `${formatMoney(min)} – ${formatMoney(max)}`
      : min != null ? `Desde ${formatMoney(min)}` : `Hasta ${formatMoney(max!)}`;
    chips.push({ key: 'price', label });
  }
  if (filters.onSale) chips.push({ key: 'onSale', label: 'En oferta' });
  if (filters.inStock) chips.push({ key: 'inStock', label: 'Disponibles' });
  if (filters.featured) chips.push({ key: 'featured', label: 'Destacados' });
  return chips;
}

/** Quita el filtro de un chip (el de precio quita el mínimo y el máximo). */
export function removeChip(filters: FilterValues, key: ChipKey): FilterValues {
  const next = { ...filters };
  if (key === 'price') {
    delete next.minPrice;
    delete next.maxPrice;
  } else {
    delete next[key];
  }
  return next;
}
