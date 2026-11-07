import { Link } from 'react-router-dom';
import { useStoreData } from '../../hooks/useStoreData';
import { storefrontService, type CategoryStat } from '../../services/storefront.service';
import { ProductImage } from '../products/ProductImage';
import { Skeleton } from '../ui';
import { HomeBlock, SectionHeader } from './SectionHeader';

/** "Compra por categoría": tarjetas con la foto de un producto y cuántos productos hay. */
export function CategoryTiles({ title, subtitle }: { title: string; subtitle?: string }) {
  const { data, loading } = useStoreData<CategoryStat[]>('categories:stats', storefrontService.getCategoryStats);
  // Solo categorías con productos: una tarjeta vacía no lleva a ningún lado.
  const categories = (data ?? []).filter((c) => c.productCount > 0).slice(0, 12);

  if (!loading && categories.length === 0) return null;

  return (
    <HomeBlock>
      <SectionHeader title={title} subtitle={subtitle} to="/catalog" linkLabel="Ver catálogo" />
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <Skeleton className="aspect-[4/3] w-full rounded-none" />
                <div className="p-3 space-y-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))
          : categories.map((c) => (
              <Link
                key={c.id}
                to={`/catalog?category=${encodeURIComponent(c.slug)}`}
                className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500"
              >
                <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                  <ProductImage src={c.image} alt={c.name} width={320} iconClassName="w-7 h-7" />
                </div>
                <div className="p-2 sm:p-3">
                  <p className="font-medium text-gray-900 text-xs sm:text-sm truncate group-hover:text-app-700">{c.name}</p>
                  <p className="text-[11px] sm:text-xs text-gray-500">
                    {c.productCount} {c.productCount === 1 ? 'producto' : 'productos'}
                  </p>
                </div>
              </Link>
            ))}
      </div>
    </HomeBlock>
  );
}
