import { useState, useMemo, useEffect, useRef } from 'react';
import { Percent, Search, X } from 'lucide-react';
import { SearchInput, Spinner } from '../components/ui';
import { PageHeader } from '../components/shared/PageHeader';
import { useSearchParams } from 'react-router-dom';
import { useProducts } from '../context/ProductsContext';

import { ProductGrid } from '../components/products/ProductGrid';
import { Seo } from '../components/seo/Seo';
import { ProductFilters, type FilterValues } from '../components/products/ProductFilters';
import { ProductSort } from '../components/products/ProductSort';
import { Pagination } from '../components/common/Pagination';
import type { ProductCategory, ProductTypeSlug } from '../types/product';

const SORT_FROM_URL: Record<string, 'price-asc' | 'price-desc' | 'newest' | 'rating' | 'popular'> = {
  price: 'price-asc',
  'price-asc': 'price-asc',
  'price-desc': 'price-desc',
  newest: 'newest',
  rating: 'rating',
  reviewsCount: 'popular',
  bestsellers: 'popular',
};

/** Filtros del panel lateral que vienen en la URL (sin buscador ni ofertas). */
function sidebarFiltersFromUrl(params: URLSearchParams): FilterValues {
  const f: FilterValues = {};
  const category = params.get('category');
  const type = params.get('type');
  if (category) f.category = category as ProductCategory;
  if (type) f.type = type as ProductTypeSlug;
  if (params.get('featured') === 'true') f.featured = true;
  if (params.get('inStock') === 'true') f.inStock = true;
  if (params.get('bestsellers') === 'true') f.bestsellers = true;
  if (params.get('newArrivals') === 'true') f.newArrivals = true;
  return f;
}

const isOn = (v: string | null) => v === '1' || v === 'true';

export const CatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filteredProducts, filters, setFilters, sortOption, setSortOption, isLoading } = useProducts();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  // La URL manda: ?search= (buscador del encabezado), ?onSale=1 (Ofertas) y los filtros.
  const urlSearch = searchParams.get('search') ?? '';
  const urlOnSale = isOn(searchParams.get('onSale'));
  const urlKey = searchParams.toString();
  const initialFilters = useMemo(() => sidebarFiltersFromUrl(new URLSearchParams(urlKey)), [urlKey]);

  // Texto del buscador de la barra (se sincroniza con la URL con una pequeña espera).
  const [searchText, setSearchText] = useState(urlSearch);
  useEffect(() => { setSearchText(urlSearch); }, [urlSearch]);

  // Aplicar la URL a los filtros del listado (el backend filtra búsqueda y ofertas).
  const lastApplied = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(urlKey);
    const next: FilterValues = { ...sidebarFiltersFromUrl(params) };
    if (urlSearch.trim()) next.search = urlSearch.trim();
    if (urlOnSale) next.onSale = true;

    const sort = params.get('sort');
    if (sort && SORT_FROM_URL[sort]) setSortOption(SORT_FROM_URL[sort]);

    const serialized = JSON.stringify(next);
    if (serialized !== lastApplied.current && serialized !== JSON.stringify(filters)) {
      setFilters(next);
      setCurrentPage(1);
    }
    lastApplied.current = serialized;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey]);

  // Escribir en la URL lo que se teclea en la barra del catálogo.
  useEffect(() => {
    if (searchText.trim() === urlSearch.trim()) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(urlKey);
      if (searchText.trim()) params.set('search', searchText.trim());
      else params.delete('search');
      setSearchParams(params, { replace: true });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const clearParam = (name: string) => {
    const params = new URLSearchParams(urlKey);
    params.delete(name);
    setSearchParams(params);
  };

  // Paginación local sobre la página que devuelve el API.
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  // El panel lateral solo conoce sus filtros: se conservan búsqueda y ofertas de la URL.
  const handleFilterChange = (sidebar: FilterValues) => {
    const next: FilterValues = { ...sidebar };
    if (urlSearch.trim()) next.search = urlSearch.trim();
    if (urlOnSale) next.onSale = true;
    setFilters(next);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const title = urlSearch ? `Resultados para “${urlSearch}”` : urlOnSale ? 'Ofertas' : 'Catálogo de Productos';
  const subtitle = urlSearch
    ? 'Productos que coinciden con tu búsqueda'
    : urlOnSale ? 'Productos con descuento vigente' : 'Explora nuestra colección completa de productos personalizables';

  const chip = 'inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full bg-app-50 text-app-700 text-xs font-medium';

  return (
    <div className="min-h-screen bg-gray-50">
      <Seo title={urlSearch ? `Buscar: ${urlSearch}` : urlOnSale ? 'Ofertas' : 'Catálogo'} description="Explora todos nuestros productos y personalízalos a tu gusto." />
      <PageHeader title={title} subtitle={subtitle} backLabel="Inicio" backTo="/" />

      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        {/* Barra: contador + buscador + ordenar */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="text-sm text-gray-500 order-2 sm:order-1 w-full sm:w-auto px-1 flex items-center gap-2 flex-wrap">
            {isLoading ? (
              <span>Cargando productos...</span>
            ) : (
              <span>
                Mostrando <span className="font-semibold text-gray-900">{paginatedProducts.length}</span> de{' '}
                <span className="font-semibold text-gray-900">{filteredProducts.length}</span> productos
              </span>
            )}
            {urlSearch && (
              <span className={chip}>
                <Search className="w-3.5 h-3.5" />
                <span className="max-w-[160px] truncate">{urlSearch}</span>
                <button type="button" title="Quitar búsqueda" aria-label="Quitar búsqueda" onClick={() => clearParam('search')} className="p-0.5 rounded-full hover:bg-app-100">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            {urlOnSale && (
              <span className={chip}>
                <Percent className="w-3.5 h-3.5" />
                Ofertas
                <button type="button" title="Quitar filtro de ofertas" aria-label="Quitar filtro de ofertas" onClick={() => clearParam('onSale')} className="p-0.5 rounded-full hover:bg-app-100">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 order-1 sm:order-2 w-full sm:w-auto">
            <SearchInput value={searchText} onChange={setSearchText} placeholder="Buscar productos…" className="flex-1 sm:w-64" />
            <ProductSort value={sortOption} onChange={setSortOption} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1">
            <ProductFilters onFilterChange={handleFilterChange} initialFilters={initialFilters} />
          </aside>

          <main className="lg:col-span-3 min-w-0">
            {isLoading ? (
              <Spinner label="Cargando productos…" className="py-20" />
            ) : (
              <>
                <ProductGrid products={paginatedProducts} />
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  itemsPerPage={itemsPerPage}
                  totalItems={filteredProducts.length}
                  onItemsPerPageChange={handleItemsPerPageChange}
                />
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
