import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '../ui';
import { ProductCard } from './ProductCard';
import type { Product } from '../../types/product';

/**
 * Fila deslizable de productos con título, "Ver todo" y flechas en escritorio.
 * La usan los relacionados del detalle y las recomendaciones del carrito.
 */
export function ProductRail({ title, products, loading = false, viewAllTo }: {
  title: string;
  products: Product[];
  loading?: boolean;
  viewAllTo?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 0, right: el.scrollLeft < el.scrollWidth - el.clientWidth - 1 });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [products, update]);

  if (!loading && products.length === 0) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };
  const arrow = 'hidden md:flex absolute top-[38%] -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-gray-200 shadow-sm items-center justify-center text-gray-700 hover:text-app-700 transition-colors';

  return (
    <section aria-label={title}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-lg md:text-xl font-bold text-gray-900">{title}</h2>
        {viewAllTo && (
          <Link to={viewAllTo} className="inline-flex items-center gap-1 text-sm font-medium text-app-700 hover:text-app-800">
            Ver todo <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      <div className="relative">
        {edges.left && (
          <button type="button" onClick={() => scrollBy(-1)} aria-label="Anteriores" className={`${arrow} -left-4`}>
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div ref={scroller} className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide scroll-smooth snap-x pb-1">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[46%] sm:w-[31%] lg:w-[23%] xl:w-[18.6%] bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <Skeleton className="aspect-square w-full rounded-none" />
                  <div className="p-3 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/3" /></div>
                </div>
              ))
            : products.map((p) => (
                <div key={p.id} className="flex-shrink-0 snap-start w-[46%] sm:w-[31%] lg:w-[23%] xl:w-[18.6%]">
                  <ProductCard product={p} />
                </div>
              ))}
        </div>
        {edges.right && (
          <button type="button" onClick={() => scrollBy(1)} aria-label="Siguientes" className={`${arrow} -right-4`}>
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </section>
  );
}
