import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { productsService, type ProductFilters } from '../../services/products.service';
import { Skeleton } from '../ui';
import { useStoreData } from '../../hooks/useStoreData';
import type { ProductSection } from '../../types/settings';
import type { Product } from '../../types/product';

interface FeaturedProductsProps {
  title?: string;
  subtitle?: string;
  section?: ProductSection;
}

/** Parámetros del API para una sección configurada (solo activos; sin sección = destacados). */
function buildSectionQuery(section?: ProductSection): ProductFilters {
  const filters: ProductFilters = { limit: section?.maxProducts || 8, isActive: true };
  const f = section?.filters;
  if (!f) {
    filters.featured = true;
    return filters;
  }
  const category = f.category || f.categoryId;
  const type = f.type || f.productTypeId;
  if (category) filters.category = category;
  if (type) filters.type = type;
  if (f.featured) filters.featured = true;
  if (f.inStock) filters.inStock = true;
  if (f.minPrice != null) filters.minPrice = f.minPrice;
  if (f.maxPrice != null) filters.maxPrice = f.maxPrice;
  const sort: Record<string, [string, 'asc' | 'desc']> = {
    price: ['basePrice', 'asc'],
    rating: ['rating', 'desc'],
    newest: ['createdAt', 'desc'],
    reviewsCount: ['reviewsCount', 'desc'],
  };
  // "Más vendidos" no tiene métrica de ventas en el API: se ordena por nº de reseñas.
  const sortKey = f.sortBy || (f.bestsellers ? 'reviewsCount' : f.newArrivals ? 'newest' : undefined);
  if (sortKey && sort[sortKey]) [filters.sortBy, filters.sortOrder] = sort[sortKey];
  return filters;
}

export const FeaturedProducts = ({ title, subtitle, section }: FeaturedProductsProps) => {
  const navigate = useNavigate();

  // Filtros de la sección en una clave PRIMITIVA: el efecto de carga solo depende de ella,
  // así que recrear el objeto `section` (al cargar ajustes) no vuelve a pedir los productos.
  const query = buildSectionQuery(section);
  const queryKey = JSON.stringify(query);
  const { data, loading: isLoading } = useStoreData<Product[]>(
    `products:${queryKey}`,
    () => productsService.getAll(JSON.parse(queryKey) as ProductFilters).then((r) => r.data || []),
  );
  const products = data ?? [];

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
  }, [data, updateScrollButtons]);

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

  const arrowClass = 'absolute top-[40%] -translate-y-1/2 z-10 w-9 h-9 bg-white rounded-full border border-gray-200 shadow-sm flex items-center justify-center text-gray-700 hover:text-app-700 hover:border-app-300 transition-colors opacity-0 group-hover/carousel:opacity-100 focus:opacity-100';

  return (
    <section className="py-5 md:py-7">
      <div className="max-w-7xl mx-auto px-4">
        {/* Encabezado de la sección */}
        <div className="flex items-end justify-between gap-4 mb-4">
          <div className="min-w-0">
            <h2 className="text-lg md:text-xl font-bold text-gray-900">
              {title || section?.title || 'Productos destacados'}
            </h2>
            {(section?.showSubtitle !== false) && (subtitle || section?.subtitle) && (
              <p className="text-gray-500 text-sm mt-0.5">{subtitle || section?.subtitle}</p>
            )}
          </div>
          {showViewAll && (
            <button
              type="button"
              onClick={() => navigate(viewAllLink)}
              className="flex-shrink-0 flex items-center gap-1 text-sm font-medium text-app-700 hover:text-app-800 group"
            >
              Ver todo
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>

        {/* Carrusel de productos */}
        {isLoading ? (
          <div className="flex gap-3 sm:gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[160px] sm:w-[200px] md:w-[220px] bg-white rounded-xl border border-gray-200 overflow-hidden">
                <Skeleton className="aspect-square w-full rounded-none" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="relative group/carousel">
            {canScrollLeft && (
              <button type="button" onClick={() => scroll('left')} className={`${arrowClass} left-0 -translate-x-1/2`} title="Anterior" aria-label="Anterior">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            <div ref={scrollContainerRef} className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-1">
              {products.map((product, i) => (
                <div key={product.id} className="flex-shrink-0 w-[160px] sm:w-[200px] md:w-[220px] flex">
                  <div className="w-full [&>a]:h-full"><ProductCard product={product} priority={i < 4} /></div>
                </div>
              ))}
            </div>

            {canScrollRight && (
              <button type="button" onClick={() => scroll('right')} className={`${arrowClass} right-0 translate-x-1/2`} title="Siguiente" aria-label="Siguiente">
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
