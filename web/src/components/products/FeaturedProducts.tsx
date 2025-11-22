import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { getProducts } from '../../data/mockProducts';
import { useCart } from '../../context/CartContext';
import type { Product } from '../../types/product';

export const FeaturedProducts = () => {
  const navigate = useNavigate();
  const { addStandardProduct } = useCart();
  const featuredProducts = getProducts({ featured: true, limit: 4 });

  const handleAddToCart = (product: Product) => {
    // Agregar con opciones por defecto (primer color y talla)
    const defaultColor = product.colors[0]?.hex || '#FFFFFF';
    const defaultSize = product.sizes[0] || 'M';

    addStandardProduct(product, defaultColor, defaultSize, 1);

    // TODO: Mostrar toast de confirmación
    alert(`${product.name} agregado al carrito!`);
  };

  const handleCustomize = (product: Product) => {
    // Navegar al personalizador con el producto seleccionado
    navigate(`/customizer?product=${product.id}`);
  };

  return (
    <section className="py-12 md:py-16 px-4 bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Productos Destacados
            </h2>
            <p className="text-gray-600">
              Los más populares y personalizables de nuestra colección
            </p>
          </div>
          <button
            onClick={() => navigate('/catalog')}
            className="hidden md:flex items-center gap-2 text-purple-600 hover:text-purple-700 font-semibold transition-colors group"
          >
            Ver todo
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={handleAddToCart}
              onCustomize={handleCustomize}
            />
          ))}
        </div>

        {/* Mobile View All Button */}
        <div className="md:hidden mt-8 text-center">
          <button
            onClick={() => navigate('/catalog')}
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Ver todos los productos
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
};
