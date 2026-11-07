import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useStoreData } from '../../../hooks/useStoreData';
import { storefrontService, type CategoryStat } from '../../../services/storefront.service';

/** Índice de categorías como una lista tipográfica grande: nombre, cuántos productos y flecha. */
export function CategoryIndex() {
  const { data } = useStoreData<CategoryStat[]>('categories:stats', storefrontService.getCategoryStats);
  const categories = (data ?? []).filter((c) => c.productCount > 0).slice(0, 8);
  if (categories.length === 0) return null;

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <h2 className="text-lg font-semibold text-gray-500">Por tipo de prenda</h2>
        <ul className="mt-4 border-t-2 border-app-600">
          {categories.map((c) => (
            <li key={c.id} className="border-b border-black/10">
              <Link
                to={`/catalog?category=${encodeURIComponent(c.slug)}`}
                className="group flex items-center gap-4 py-5 md:py-6 focus:outline-none focus-visible:bg-app-50"
              >
                <span className="font-poster font-bold tracking-[-0.035em] uppercase text-[clamp(1.8rem,4.5vw,3.6rem)] leading-none text-gray-900 transition-[color,transform] duration-300 group-hover:translate-x-2">
                  {c.name}
                </span>
                <span className="ml-auto text-sm md:text-base text-gray-500 tabular-nums">
                  {c.productCount} {c.productCount === 1 ? 'producto' : 'productos'}
                </span>
                <ArrowUpRight className="w-7 h-7 md:w-9 md:h-9 text-gray-900 transition-transform duration-300 group-hover:rotate-45" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
