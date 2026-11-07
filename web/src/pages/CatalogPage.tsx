import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PackageSearch, SlidersHorizontal, X } from 'lucide-react';
import { Button, Drawer, Skeleton } from '../components/ui';
import { PageHeader } from '../components/shared/PageHeader';
import { StoreContainer } from '../components/shared/StoreContainer';
import { useProducts } from '../context/ProductsContext';
import { useCatalogs } from '../context/CatalogsContext';
import { useCurrency } from '../hooks/useCurrency';
import { ProductCard } from '../components/products/ProductCard';
import { Seo } from '../components/seo/Seo';
import { ProductFilters, type FilterValues } from '../components/products/ProductFilters';
import { ProductSort } from '../components/products/ProductSort';
import { Pagination } from '../components/common/Pagination';
import {
  activeChips,
  compactFilters,
  readCatalogParams,
  removeChip,
  tagLabel,
  writeCatalogParams,
  type CatalogState,
  type ChipKey,
} from '../components/products/catalogParams';

const GRID = 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4';

export const CatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filteredProducts, filters, setFilters, sortOption, setSortOption, setPage, pagination, isLoading } = useProducts();
  const { categories, productTypes } = useCatalogs();
  const { format } = useCurrency();
  const [filtersOpen, setFiltersOpen] = useState(false);

  // La URL es la fuente de verdad (se puede compartir y "atrás" deshace el último filtro).
  const urlKey = searchParams.toString();
  const state = useMemo(() => readCatalogParams(new URLSearchParams(urlKey)), [urlKey]);

  // URL → listado (el API filtra, ordena y pagina).
  useEffect(() => {
    const next = compactFilters(state.filters);
    if (JSON.stringify(next) !== JSON.stringify(compactFilters(filters))) setFilters(next);
    if (state.sort !== sortOption) setSortOption(state.sort);
    setPage(state.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey]);

  const go = (next: Partial<CatalogState>, opts?: { replace?: boolean }) => {
    // Cambiar filtros u orden vuelve a la primera página.
    const merged: CatalogState = { ...state, page: 1, ...next };
    setSearchParams(writeCatalogParams(merged), opts);
  };
  const changeFilters = (f: FilterValues) => go({ filters: compactFilters(f) });

  const categoryName = (slug: string) => categories.find((c) => c.slug === slug)?.name;
  const typeName = (slug: string) => productTypes.find((t) => t.slug === slug)?.name;
  const chips = activeChips(state.filters, { category: categoryName, type: typeName }, format);
  const removeOne = (key: ChipKey) => go({ filters: removeChip(state.filters, key) });
  const clearAll = () => go({ filters: {} });

  const { search, onSale, category, tag } = state.filters;
  const title = search
    ? `Resultados para «${search}»`
    : tag ? tagLabel(tag) : category ? categoryName(category) ?? 'Catálogo' : onSale ? 'Ofertas' : 'Catálogo';
  const total = pagination.total || filteredProducts.length;
  const countLabel = isLoading ? 'Buscando productos…' : `${total} ${total === 1 ? 'producto' : 'productos'}`;
  const filterCount = chips.filter((c) => c.key !== 'search').length;

  const handlePageChange = (page: number) => {
    go({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Seo title={search ? `Buscar: ${search}` : title} description="Explora todos nuestros productos y personalízalos a tu gusto." />
      <PageHeader title={title} subtitle={countLabel} backLabel="Catálogo" backTo={search || category || onSale || tag ? '/catalog' : '/'} />

      <StoreContainer>
        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6 items-start">
          {/* Filtros (escritorio): columna fija que acompaña el scroll */}
          <aside
            className="hidden lg:block sticky bg-white rounded-xl border border-gray-200 p-4 max-h-[calc(100vh-var(--store-header-h,120px)-2rem)] overflow-y-auto"
            style={{ top: 'calc(var(--store-header-h, 120px) + 1rem)' }}
            aria-label="Filtros"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Filtros</h2>
              {filterCount > 0 && (
                <button type="button" onClick={clearAll} className="text-xs font-medium text-app-700 hover:underline">Limpiar</button>
              )}
            </div>
            <ProductFilters value={state.filters} onChange={changeFilters} />
          </aside>

          <div className="min-w-0 space-y-4">
            {/* Barra: filtros (celular), filtros activos y orden */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="lg:hidden"
                icon={<SlidersHorizontal className="w-4 h-4" />}
                onClick={() => setFiltersOpen(true)}
              >
                Filtros{filterCount > 0 ? ` (${filterCount})` : ''}
              </Button>
              <p className="hidden lg:block text-sm text-gray-500" aria-live="polite">{countLabel}</p>
              <div className="ml-auto">
                <ProductSort value={state.sort} onChange={(sort) => go({ sort })} />
              </div>
            </div>

            {chips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2" aria-label="Filtros activos">
                {chips.map((c) => (
                  <span key={c.key} className="inline-flex items-center gap-1 h-8 pl-3 pr-1 rounded-full bg-white border border-gray-200 text-sm text-gray-700">
                    <span className="max-w-[180px] truncate">{c.label}</span>
                    <button
                      type="button"
                      onClick={() => removeOne(c.key)}
                      aria-label={`Quitar filtro ${c.label}`}
                      title="Quitar"
                      className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                {chips.length > 1 && (
                  <button type="button" onClick={clearAll} className="text-sm font-medium text-app-700 hover:underline px-1">
                    Limpiar todo
                  </button>
                )}
              </div>
            )}

            {isLoading ? (
              <div className={GRID}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <Skeleton className="aspect-square w-full rounded-none" />
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 px-6 py-14 text-center">
                <PackageSearch className="w-10 h-10 text-gray-300 mx-auto" strokeWidth={1.5} />
                <h2 className="mt-3 text-base font-semibold text-gray-900">No encontramos productos</h2>
                <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
                  {search
                    ? 'Revisa la ortografía o prueba con una palabra más general.'
                    : 'Ningún producto coincide con estos filtros. Quita alguno para ver más resultados.'}
                </p>
                <div className="mt-5 flex flex-col sm:flex-row justify-center gap-2">
                  {chips.length > 0 && <Button onClick={clearAll}>Quitar filtros</Button>}
                  <Button variant="secondary" onClick={() => setSearchParams(new URLSearchParams())}>Ver todo el catálogo</Button>
                </div>
              </div>
            ) : (
              <>
                <div className={GRID}>
                  {filteredProducts.map((product, i) => (
                    <ProductCard key={product.id} product={product} priority={i < 4} />
                  ))}
                </div>
                {pagination.totalPages > 1 && (
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={handlePageChange}
                    itemsPerPage={pagination.limit}
                    totalItems={total}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </StoreContainer>

      {/* Filtros (celular y tableta) */}
      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtros"
        width="sm"
        footer={
          <>
            {filterCount > 0 && <Button variant="secondary" onClick={clearAll}>Limpiar</Button>}
            <Button onClick={() => setFiltersOpen(false)}>{isLoading ? 'Ver resultados' : `Ver ${total} ${total === 1 ? 'resultado' : 'resultados'}`}</Button>
          </>
        }
      >
        <ProductFilters value={state.filters} onChange={changeFilters} />
      </Drawer>
    </div>
  );
};
