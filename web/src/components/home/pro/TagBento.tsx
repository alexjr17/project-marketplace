import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { coverFor, tagHref, useTags } from './useTags';

/**
 * "Compra por temática": mosaico con la temática principal grande y las siguientes en
 * tarjetas más chicas. Cada tarjeta lleva al catálogo filtrado por esa temática.
 */
export function TagBento({ title }: { title: string }) {
  const { tags } = useTags();
  const list = tags.slice(0, 5);
  if (list.length < 2) return null;

  // Layout por cantidad: la primera ocupa 2×2 en escritorio cuando hay 3 o más.
  const big = list.length >= 3;

  return (
    <section className="bg-paper pb-14 md:pb-20">
      <div className="max-w-7xl mx-auto px-3 md:px-6">
        <h2 className="font-poster font-bold tracking-[-0.035em] uppercase leading-[0.9] text-[clamp(2rem,4.5vw,3.6rem)] text-gray-900">
          {title}
        </h2>
        <ul className={`mt-8 grid grid-cols-2 ${big ? 'lg:grid-cols-4 lg:grid-rows-2' : 'lg:grid-cols-2'} gap-3 md:gap-4 lg:h-[620px]`}>
          {list.map((t, i) => {
            const cover = coverFor(i);
            const first = big && i === 0;
            return (
              <li key={t.tag} className={`${first ? 'col-span-2 lg:row-span-2' : ''} ${list.length === 4 && i === 3 ? 'lg:col-span-2' : ''}`}>
                <Link
                  to={tagHref(t.tag)}
                  className={`group relative block h-full overflow-hidden rounded-[1.5rem] bg-gray-900 ${first ? 'aspect-[4/3] lg:aspect-auto' : 'aspect-[4/5] lg:aspect-auto'} focus:outline-none focus-visible:ring-4 focus-visible:ring-app-300`}
                >
                  <img
                    src={cover.src}
                    srcSet={cover.srcSet}
                    sizes={first ? '(min-width: 1024px) 50vw, 100vw' : '(min-width: 1024px) 25vw, 50vw'}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" aria-hidden="true" />
                  <span className="absolute top-3 right-3 w-10 h-10 rounded-full bg-accent text-accent-ink flex items-center justify-center transition-transform duration-300 group-hover:rotate-45" aria-hidden="true">
                    <ArrowUpRight className="w-5 h-5" />
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-4 md:p-6">
                    <span className={`block font-poster font-bold tracking-[-0.035em] uppercase text-white leading-[0.9] ${first ? 'text-[clamp(2.4rem,5vw,4.4rem)]' : 'text-[clamp(1.5rem,2.4vw,2.1rem)]'}`}>
                      {t.name}
                    </span>
                    <span className="mt-1 block text-sm text-white/85">{t.productCount} {t.productCount === 1 ? 'producto' : 'productos'}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
