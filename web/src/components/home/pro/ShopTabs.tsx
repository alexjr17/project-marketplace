import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStoreData } from '../../../hooks/useStoreData';
import type { Product } from '../../../types/product';
import { Skeleton } from '../../ui';
import { fetchShowcase, type ShowcaseTab } from '../storeQueries';
import { StoreCard } from './StoreCard';

const TABS: { id: ShowcaseTab; label: string; href: string }[] = [
  { id: 'new', label: 'Novedades', href: '/catalog' },
  { id: 'top', label: 'Más vendidos', href: '/catalog?sort=popular' },
  { id: 'sale', label: 'Ofertas', href: '/catalog?onSale=1' },
];

/** Productos de la tienda con pestañas (novedades, más vendidos, ofertas). */
export function ShopTabs({ title }: { title: string }) {
  const [tab, setTab] = useState<ShowcaseTab>('new');
  const { data, loading } = useStoreData<Product[]>(`showcase:${tab}`, fetchShowcase(tab));
  const items = (data ?? []).slice(0, 8);
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="max-w-7xl mx-auto px-3 md:px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <h2 className="font-poster font-bold tracking-[-0.035em] uppercase leading-[0.9] text-[clamp(2rem,4.5vw,3.6rem)] text-gray-900">
            {title}
          </h2>
          <div className="flex items-center gap-1 p-1 rounded-full bg-black/5 w-fit" role="tablist" aria-label="Ver productos">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === tab}
                onClick={() => setTab(t.id)}
                className={`h-10 px-4 md:px-5 rounded-full text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500 ${
                  t.id === tab ? 'bg-app-600 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <ul className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-x-3 md:gap-x-5 gap-y-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i}><Skeleton className="aspect-[4/5] w-full rounded-2xl" /><Skeleton className="h-4 w-2/3 mt-3" /><Skeleton className="h-4 w-1/3 mt-2" /></li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <p className="mt-8 rounded-2xl bg-white px-6 py-12 text-center text-gray-600">
            {tab === 'sale' ? 'No hay ofertas en este momento. Vuelve pronto o mira las novedades.' : 'Aún no hay productos aquí.'}
          </p>
        ) : (
          <ul className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-x-3 md:gap-x-5 gap-y-8 md:gap-y-10">
            {items.map((p, i) => (
              <li key={p.id}><StoreCard product={p} priority={i < 2} /></li>
            ))}
          </ul>
        )}

        <div className="mt-10 flex justify-center">
          <Link
            to={current.href}
            className="inline-flex items-center h-12 px-7 rounded-full border-2 border-app-600 text-app-600 text-[15px] font-semibold hover:bg-app-600 hover:text-white active:scale-[0.98] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-300"
          >
            Ver todo en {current.label.toLowerCase()}
          </Link>
        </div>
      </div>
    </section>
  );
}
