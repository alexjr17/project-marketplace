import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { ProductCard } from './ProductCard';
import productsService from '../../services/products.service';
import type { Product } from '../../types/product';

interface RelatedProductsProps {
  product: Product;
  limit?: number;
}

export function RelatedProducts({ product, limit = 12 }: RelatedProductsProps) {
  const navigate = useNavigate();
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Carrusel
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);


  const updateScrollButtons = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 1);
    }
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (container) {
      const cardWidth = container.querySelector('a')?.offsetWidth || 200;
      const scrollAmount = cardWidth * 2;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      updateScrollButtons();
      container.addEventListener('scroll', updateScrollButtons);
      window.addEventListener('resize', updateScrollButtons);
      return () => {
        container.removeEventListener('scroll', updateScrollButtons);
        window.removeEventListener('resize', updateScrollButtons);
      };
    }
  }, [relatedProducts, updateScrollButtons]);

  useEffect(() => {
    const fetchRelatedProducts = async () => {
      setLoading(true);
      try {
        // Obtener productos de la misma categoría
        const response = await productsService.getAll({
          category: product.categorySlug || product.category,
          limit: limit + 5,
        });

        // Filtrar el producto actual
        let filtered = response.data.filter(p => p.id !== product.id);

        // Ordenar por cantidad de tags coincidentes
        if (product.tags && product.tags.length > 0) {
          filtered.sort((a, b) => {
            const aMatches = a.tags?.filter(t => product.tags?.includes(t)).length || 0;
            const bMatches = b.tags?.filter(t => product.tags?.includes(t)).length || 0;
            return bMatches - aMatches;
          });
        }

        setRelatedProducts(filtered.slice(0, limit));
      } catch (error) {
        console.error('Error fetching related products:', error);
        setRelatedProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRelatedProducts();
  }, [product.id, product.categorySlug, product.category, product.tags, limit]);

  // No mostrar si no hay productos relacionados
  if (!loading && relatedProducts.length === 0) {
    return null;
  }

  // Link al catálogo filtrado por categoría
  const viewAllLink = product.categorySlug
    ? `/catalog?category=${product.categorySlug}`
    : '/catalog';

  return (
    <section>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-bold text-gray-900">
            Productos relacionados
          </h2>
          <button
            onClick={() => navigate(viewAllLink)}
            className="flex items-center gap-1 text-sm font-medium text-app-700 hover:text-app-800 group"
          >
            Ver todo
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Carrusel */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="relative group/carousel">
          {/* Flecha Izquierda */}
          {canScrollLeft && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white rounded-full border border-gray-200 shadow-sm flex items-center justify-center text-gray-700 hover:text-app-700 transition-colors opacity-0 group-hover/carousel:opacity-100 -translate-x-1/2"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Contenedor Scroll */}
          <div
            ref={scrollContainerRef}
            className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-1"
          >
            {relatedProducts.map((relatedProduct) => (
              <div key={relatedProduct.id} className="flex-shrink-0 w-[160px] sm:w-[180px] md:w-[200px]">
                <ProductCard product={relatedProduct} />
              </div>
            ))}
          </div>

          {/* Flecha Derecha */}
          {canScrollRight && (
            <button
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white rounded-full border border-gray-200 shadow-sm flex items-center justify-center text-gray-700 hover:text-app-700 transition-colors opacity-0 group-hover/carousel:opacity-100 translate-x-1/2"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
