import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { productsService, type ProductFilters } from '../../services/products.service';
import { useSettings } from '../../context/SettingsContext';
import type { ProductSection } from '../../types/settings';
import type { Product } from '../../types/product';

interface FeaturedProductsProps {
  title?: string;
  subtitle?: string;
  section?: ProductSection;
}

export const FeaturedProducts = ({ title, subtitle, section }: FeaturedProductsProps) => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      const cardWidth = container.querySelector('div')?.offsetWidth || 200;
      const scrollAmount = cardWidth * 2; // Scroll 2 cards at a time
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
  }, [products, updateScrollButtons]);

  // Cargar productos desde la API
  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      try {
        const filters: ProductFilters = {
          limit: section?.maxProducts || 8,
        };

        // Aplicar filtros de la sección
        if (section?.filters) {
          const sectionFilters = section.filters;

          // Filtros de categoría y tipo
          const category = sectionFilters.category || sectionFilters.categoryId;
          const type = sectionFilters.type || sectionFilters.productTypeId;
          if (category) filters.category = category;
          if (type) filters.type = type;

          // Filtros booleanos
          if (sectionFilters.featured) filters.featured = true;
          if (sectionFilters.inStock) filters.inStock = true;

          // Ordenamiento
          if (sectionFilters.sortBy) {
            switch (sectionFilters.sortBy) {
              case 'price':
                filters.sortBy = 'basePrice';
                filters.sortOrder = 'asc';
                break;
              case 'rating':
                filters.sortBy = 'rating';
                filters.sortOrder = 'desc';
                break;
              case 'newest':
                filters.sortBy = 'createdAt';
                filters.sortOrder = 'desc';
                break;
              case 'reviewsCount':
                filters.sortBy = 'reviewsCount';
                filters.sortOrder = 'desc';
                break;
            }
          }
        } else {
          // Por defecto, productos destacados
          filters.featured = true;
        }

        const response = await productsService.getAll(filters);
        setProducts(response.data || []);
      } catch (error) {
        console.error('Error loading featured products:', error);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, [section?.filters, section?.maxProducts]);

  // Colores de marca dinámicos
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };

  // Generar link de "Ver todo" con filtros dinámicos
  const getViewAllLink = () => {
    // Si hay un viewAllLink personalizado, usarlo directamente
    if (section?.viewAllLink) {
      return section.viewAllLink;
    }

    if (!section?.filters || Object.keys(section.filters).length === 0) {
      return '/catalog';
    }

    const params = new URLSearchParams();
    const filters = section.filters;

    // Filtros booleanos
    if (filters.featured) params.set('featured', 'true');
    if (filters.bestsellers) params.set('bestsellers', 'true');
    if (filters.newArrivals) params.set('newArrivals', 'true');
    if (filters.inStock) params.set('inStock', 'true');

    // Filtros de categoría/tipo - usar campos nuevos con fallback a los antiguos
    const category = filters.category || filters.categoryId;
    const type = filters.type || filters.productTypeId;
    if (category) params.set('category', category);
    if (type) params.set('type', type);

    // Ordenamiento
    if (filters.sortBy) params.set('sort', filters.sortBy);

    const queryString = params.toString();
    return queryString ? `/catalog?${queryString}` : '/catalog';
  };

  const viewAllLink = getViewAllLink();
  const showViewAll = section?.showViewAll ?? true;

  // Si no hay productos y ya terminó de cargar, no mostrar la sección
  if (!isLoading && products.length === 0) {
    return null;
  }

  return (
    <section className="py-4 md:py-6">
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm">
          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                {title || section?.title || 'Productos Destacados'}
              </h2>
              {showViewAll && (
                <button
                  onClick={() => navigate(viewAllLink)}
                  className="flex items-center gap-1 text-sm font-semibold transition-colors group"
                  style={{ color: brandColors.primary }}
                >
                  Ver todo
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </div>
            {(section?.showSubtitle !== false) && (subtitle || section?.subtitle) && (
              <p className="text-gray-500 text-sm mt-1">
                {subtitle || section?.subtitle}
              </p>
            )}
          </div>

          {/* Products Carousel */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-300 border-t-gray-600"></div>
            </div>
          ) : (
            <div className="relative group/carousel">
              {/* Flecha Izquierda */}
              {canScrollLeft && (
                <button
                  onClick={() => scroll('left')}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all opacity-0 group-hover/carousel:opacity-100 -translate-x-1/2"
                  style={{ color: brandColors.primary }}
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              {/* Contenedor Scroll */}
              <div
                ref={scrollContainerRef}
                className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth"
              >
                {products.map((product, i) => (
                  <div key={product.id} className="flex-shrink-0 w-[160px] sm:w-[180px] md:w-[200px]">
                    <ProductCard product={product} priority={i < 4} />
                  </div>
                ))}
              </div>

              {/* Flecha Derecha */}
              {canScrollRight && (
                <button
                  onClick={() => scroll('right')}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all opacity-0 group-hover/carousel:opacity-100 translate-x-1/2"
                  style={{ color: brandColors.primary }}
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
