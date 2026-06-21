import { ProductCard } from './ProductCard';
import type { Product } from '../../types/product';
import { Package } from 'lucide-react';

interface ProductGridProps {
  products: Product[];
}

export const ProductGrid = ({ products }: ProductGridProps) => {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="bg-gray-100 rounded-full p-8 mb-6">
          <Package className="w-16 h-16 text-gray-400" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          No se encontraron productos
        </h3>
        <p className="text-gray-600 text-center max-w-md">
          Intenta ajustar los filtros o buscar con otros términos
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
      {products.map((product, i) => (
        <ProductCard
          key={product.id}
          product={product}
          priority={i < 4}
        />
      ))}
    </div>
  );
};
