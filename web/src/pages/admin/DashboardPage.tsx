import { useProducts } from '../../context/ProductsContext';
import { Package, TrendingUp, DollarSign, Star } from 'lucide-react';

export const DashboardPage = () => {
  const { products } = useProducts();

  // Calculate statistics
  const stats = {
    total: products.length,
    inStock: products.filter(p => p.stock > 0).length,
    lowStock: products.filter(p => p.stock > 0 && p.stock < 20).length,
    avgPrice: products.reduce((sum, p) => sum + p.basePrice, 0) / products.length || 0,
    featured: products.filter(p => p.featured).length,
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1 text-sm">Resumen general del sistema</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Total Productos */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-orange-50 rounded-lg">
                <Package className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
              </div>
            </div>
            <p className="text-xs md:text-sm text-gray-600 font-medium">Total Productos</p>
            <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
          </div>
        </div>

        {/* En Stock */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-green-50 rounded-lg">
                <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
              </div>
            </div>
            <p className="text-xs md:text-sm text-gray-600 font-medium">En Stock</p>
            <p className="text-2xl md:text-3xl font-bold text-green-600 mt-1">{stats.inStock}</p>
            {stats.lowStock > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                {stats.lowStock} stock bajo
              </p>
            )}
          </div>
        </div>

        {/* Precio Promedio */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-xs md:text-sm text-gray-600 font-medium">Precio Promedio</p>
            <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">
              ${stats.avgPrice.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Destacados */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Star className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-xs md:text-sm text-gray-600 font-medium">Destacados</p>
            <p className="text-2xl md:text-3xl font-bold text-purple-600 mt-1">{stats.featured}</p>
          </div>
        </div>
      </div>

      {/* Placeholder para gráficas futuras */}
      <div className="mt-6 bg-white rounded-lg shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Gráficas</h2>
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <p className="text-gray-500 text-sm">Las gráficas se agregarán próximamente</p>
        </div>
      </div>
    </div>
  );
};
