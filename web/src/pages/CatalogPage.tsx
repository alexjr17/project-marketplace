import { useState, useMemo, useEffect } from 'react';
import { Search } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProducts } from '../context/ProductsContext';
import { useSettings } from '../context/SettingsContext';
import { ProductGrid } from '../components/products/ProductGrid';
import { Seo } from '../components/seo/Seo';
import { ProductFilters, type FilterValues } from '../components/products/ProductFilters';
import { ProductSort } from '../components/products/ProductSort';
import { Pagination } from '../components/common/Pagination';
import type { ProductCategory, ProductType } from '../types/product';

export const CatalogPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { filteredProducts, setFilters, sortOption, setSortOption, isLoading } = useProducts();
  const { settings } = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [initialFilters, setInitialFilters] = useState<FilterValues>({});

  // Leer filtros de la URL al cargar
  useEffect(() => {
    const urlFilters: FilterValues = {};

    const category = searchParams.get('category');
    const type = searchParams.get('type');
    const featured = searchParams.get('featured');
    const inStock = searchParams.get('inStock');
    const bestsellers = searchParams.get('bestsellers');
    const newArrivals = searchParams.get('newArrivals');
    const sort = searchParams.get('sort');

    if (category) urlFilters.category = category as ProductCategory;
    if (type) urlFilters.type = type as ProductType;
    if (featured === 'true') urlFilters.featured = true;
    if (inStock === 'true') urlFilters.inStock = true;
    if (bestsellers === 'true') urlFilters.bestsellers = true;
    if (newArrivals === 'true') urlFilters.newArrivals = true;

    // Aplicar ordenamiento desde URL
    if (sort) {
      const sortMapping: Record<string, typeof sortOption> = {
        'price': 'price-asc',
        'price-asc': 'price-asc',
        'price-desc': 'price-desc',
        'newest': 'newest',
        'rating': 'rating',
        'reviewsCount': 'popular',
      };
      if (sortMapping[sort]) {
        setSortOption(sortMapping[sort]);
      }
    }

    // Solo actualizar si hay filtros y son diferentes
    const hasFilters = Object.keys(urlFilters).length > 0;
    const filtersChanged = JSON.stringify(initialFilters) !== JSON.stringify(urlFilters);

    if (hasFilters && filtersChanged) {
      setInitialFilters(urlFilters);
      setFilters(urlFilters);
    }
  }, [searchParams]);

  // Colores de marca dinámicos
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };
  const gradientStyle = `linear-gradient(to right, ${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent})`;

  // Filter by search query
  const searchFilteredProducts = useMemo(() => {
    return searchQuery
      ? filteredProducts.filter((product) =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : filteredProducts;
  }, [filteredProducts, searchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(searchFilteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return searchFilteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [searchFilteredProducts, currentPage, itemsPerPage]);

  const handleFilterChange = (filters: FilterValues) => {
    setFilters(filters);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset to first page when search changes
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when items per page changes
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Seo title="Catálogo" description="Explora todos nuestros productos y personalízalos a tu gusto." />
      {/* Header */}
      <PageHeader
        title="Catálogo de Productos"
        subtitle="Explora nuestra colección completa de productos personalizables"
        backLabel="Inicio"
        backTo="/"
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Toolbar: contador + buscador + ordenar */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="text-sm text-gray-600 order-2 sm:order-1 w-full sm:w-auto">
            {isLoading ? (
              <span>Cargando productos...</span>
            ) : (
              <span>
                Mostrando <span className="font-semibold text-gray-900">{paginatedProducts.length}</span> de{' '}
                <span className="font-semibold text-gray-900">{searchFilteredProducts.length}</span> productos
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 order-1 sm:order-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar productos..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent shadow-sm"
              />
            </div>
            <ProductSort value={sortOption} onChange={setSortOption} />
          </div>
        </div>

        {/* Layout: Sidebar + Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <aside className="lg:col-span-1">
            <ProductFilters onFilterChange={handleFilterChange} initialFilters={initialFilters} />
          </aside>

          {/* Products Grid */}
          <main className="lg:col-span-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-600 border-t-transparent"></div>
              </div>
            ) : (
              <>
                <ProductGrid products={paginatedProducts} />
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  itemsPerPage={itemsPerPage}
                  totalItems={searchFilteredProducts.length}
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
