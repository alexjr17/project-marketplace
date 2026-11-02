import { useState } from 'react';
import { Package, Percent, Star } from 'lucide-react';
import { useStoreData } from '../../hooks/useStoreData';
import type { Product } from '../../types/product';
import { ProductCard } from '../products/ProductCard';
import { EmptyState, Skeleton, Tabs } from '../ui';
import { HomeBlock, SectionHeader } from './SectionHeader';
import { fetchShowcase, type ShowcaseTab } from './storeQueries';

const TABS: Record<ShowcaseTab, { label: string; viewAll: string; empty: { title: string; description: string; icon: typeof Package } }> = {
  new: {
    label: 'Novedades',
    viewAll: '/catalog?sort=newest',
    empty: { title: 'Aún no hay productos', description: 'Vuelve pronto: estamos preparando el catálogo.', icon: Package },
  },
  top: {
    label: 'Mejor calificados',
    viewAll: '/catalog?sort=rating',
    empty: { title: 'Todavía no hay calificaciones', description: 'Cuando nuestros clientes califiquen sus compras, los mejores aparecerán aquí.', icon: Star },
  },
  sale: {
    label: 'Ofertas',
    viewAll: '/catalog?onSale=1',
    empty: { title: 'No hay ofertas activas', description: 'Revisa más tarde: las promociones aparecen aquí.', icon: Percent },
  },
};

const fetchTab = fetchShowcase;

/** Vitrina con pestañas Novedades · Mejor calificados · Ofertas. Cada pestaña pide sus datos una vez. */
export function ProductShowcase({ title, subtitle }: { title: string; subtitle?: string }) {
  const [tab, setTab] = useState<ShowcaseTab>('new');
  // Novedades y Ofertas se piden de entrada (para saber si hay ofertas); "Mejor calificados"
  // solo cuando se abre la pestaña.
  const [opened, setOpened] = useState<Record<ShowcaseTab, boolean>>({ new: true, top: false, sale: true });

  const lists = {
    new: useStoreData<Product[]>('showcase:new', fetchTab('new')),
    top: useStoreData<Product[]>(opened.top ? 'showcase:top' : null, fetchTab('top')),
    sale: useStoreData<Product[]>('showcase:sale', fetchTab('sale')),
  };

  // Sin productos calificados, "Mejor calificados" mostraría lo mismo que Novedades.
  const rated = (lists.top.data ?? []).filter((p) => (p.reviewsCount ?? 0) > 0);
  const items: Product[] = tab === 'top' ? rated : lists[tab].data ?? [];
  const loading = lists[tab].loading || (tab === 'top' && !opened.top);
  const hideSale = !lists.sale.loading && (lists.sale.data ?? []).length === 0;
  const noProducts = !lists.new.loading && (lists.new.data ?? []).length === 0;

  if (noProducts) return null; // tienda sin productos: la vitrina no aporta nada

  const select = (t: ShowcaseTab) => {
    setOpened((o) => ({ ...o, [t]: true }));
    setTab(t);
  };
  const empty = TABS[tab].empty;

  return (
    <HomeBlock>
      <SectionHeader title={title} subtitle={subtitle} to={TABS[tab].viewAll} />
      <div className="mb-4">
        <Tabs<ShowcaseTab>
          value={tab}
          onChange={select}
          tabs={[
            { value: 'new', label: TABS.new.label },
            { value: 'top', label: TABS.top.label },
            { value: 'sale', label: TABS.sale.label, hidden: hideSale && tab !== 'sale' },
          ]}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${i === 2 ? 'hidden md:block' : i > 2 ? 'hidden lg:block' : ''}`}>
              <Skeleton className="aspect-square w-full rounded-none" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {items.map((p, i) => (
            // En celular se muestran 6 (3 filas de 2); el resto, con "Ver todo".
            <div key={p.id} className={`min-w-0 ${i >= 6 ? 'hidden md:block' : ''}`}>
              <ProductCard product={p} priority={tab === 'new' && i < 2} />
            </div>
          ))}
        </div>
      )}
    </HomeBlock>
  );
}
