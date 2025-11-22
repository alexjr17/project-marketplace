import { useState } from 'react';
import { Search } from 'lucide-react';
import { useProducts } from '../context/ProductsContext';
import { useCart } from '../context/CartContext';
import { ProductGrid } from '../components/products/ProductGrid';
import { ProductFilters, type FilterValues } from '../components/products/ProductFilters';
import { ProductSort } from '../components/products/ProductSort';
import type { Product } from '../types/product';

export const CatalogPage = () => {
  const { filteredProducts, setFilters, sortOption, setSortOption, isLoading } = useProducts();
  const { addStandardProduct } = useCart();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter by search query
  const displayedProducts = searchQuery
    ? filteredProducts.filter((product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : filteredProducts;

  const handleFilterChange = (filters: FilterValues) => {
    setFilters(filters);
  };

  const handleAddToCart = (product: Product) => {
    // Agregar con opciones por defecto
    const defaultColor = product.colors[0]?.hex || '#FFFFFF';
    const defaultSize = product.sizes[0] || 'M';

    addStandardProduct(product, defaultColor, defaultSize, 1);

    // TODO: Mostrar toast de confirmación
    alert(`${product.name} agregado al carrito!`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Catálogo de Productos</h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl">
            Explora nuestra colección completa de productos personalizables
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm"
            />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="text-sm text-gray-600">
            {isLoading ? (
              <span>Cargando productos...</span>
            ) : (
              <span>
                Mostrando <span className="font-semibold text-gray-900">{displayedProducts.length}</span> de{' '}
                <span className="font-semibold text-gray-900">{filteredProducts.length}</span> productos
              </span>
            )}
          </div>
          <ProductSort value={sortOption} onChange={setSortOption} />
        </div>

        {/* Layout: Sidebar + Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <aside className="lg:col-span-1">
            <ProductFilters onFilterChange={handleFilterChange} />
          </aside>

          {/* Products Grid */}
          <main className="lg:col-span-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
              </div>
            ) : (
              <ProductGrid products={displayedProducts} onAddToCart={handleAddToCart} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
