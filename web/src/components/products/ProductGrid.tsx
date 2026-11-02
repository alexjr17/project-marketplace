import { ProductCard } from './ProductCard';
import type { Product } from '../../types/product';
import { Package } from 'lucide-react';
import { EmptyState } from '../ui';

interface ProductGridProps {
  products: Product[];
}

export const ProductGrid = ({ products }: ProductGridProps) => {
  if (products.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        <EmptyState icon={Package} title="No se encontraron productos" description="Intenta ajustar los filtros o buscar con otros términos." />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} priority={i < 4} />
      ))}
    </div>
  );
};
