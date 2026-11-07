import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useCurrency } from '../../../hooks/useCurrency';
import { useStoreData } from '../../../hooks/useStoreData';
import { productsService } from '../../../services/products.service';
import type { Product } from '../../../types/product';
import { ProductImage } from '../../products/ProductImage';
import { Skeleton } from '../../ui';
import { fetchShowcase } from '../storeQueries';
import { gsap } from './motion';
import { coverFor, tagHref, useTags } from './useTags';

const MAX_TABS = 5;
/** Cada cuánto pasa a la siguiente colección (ms). */
const ROTATE_MS = 7000;

/**
 * Hero "colección destacada": foto grande con el nombre de la temática y, al lado, productos de
 * esa temática para comprar directo. Las pestañas cambian de temática (las que más productos
 * tienen). Sin temáticas, muestra las novedades del catálogo.
 */
export function HeroCollection({ reduced }: { reduced: boolean }) {
  const { format } = useCurrency();
  const { tags, loading: tagsLoading } = useTags();
  const tabs = tags.slice(0, MAX_TABS);
  const [idx, setIdx] = useState(0);
  const current = tabs[Math.min(idx, Math.max(0, tabs.length - 1))];

  // Las colecciones pasan solas; se detienen al pasar el mouse o al enfocar, y con "menos movimiento".
  const [paused, setPaused] = useState(false);
  const rotating = !reduced && !paused && tabs.length > 1;
  useEffect(() => {
    if (!rotating) return;
    const t = window.setTimeout(() => setIdx((i) => (i + 1) % tabs.length), ROTATE_MS);
    return () => window.clearTimeout(t);
  }, [rotating, idx, tabs.length]);

  const tag = current?.tag ?? null;
  const tagged = useStoreData<Product[]>(
    tag ? `tag:${tag}` : null,
    () => productsService.getAll({ tag: tag!, limit: 3, isActive: true, sortBy: 'createdAt', sortOrder: 'desc' }).then((r) => r.data || []),
  );
  const newest = useStoreData<Product[]>(!tagsLoading && !tag ? 'showcase:new' : null, fetchShowcase('new'));
  const products = ((tag ? tagged.data : newest.data) ?? []).slice(0, 3);
  const loadingProducts = tagsLoading || (tag ? tagged.loading : newest.loading);
  // Con 3 productos las tarjetas llenan el alto del panel; con 1 o 2 quedan con su alto natural.
  const fill = loadingProducts || products.length >= 3;

  const name = current?.name ?? 'Lo nuevo';
  const href = tag ? tagHref(tag) : '/catalog';
  const count = current?.productCount;
  const cover = coverFor(Math.min(idx, Math.max(0, tabs.length - 1)));
  // El nombre va gigante, pero una palabra larga no se parte: el tamaño baja con el largo.
  const longest = Math.max(...name.split(/\s+/).map((w) => w.length));
  const nameSize = longest <= 6
    ? 'text-[clamp(3.2rem,11vw,8rem)]'
    : longest <= 9 ? 'text-[clamp(2.6rem,8.5vw,6.2rem)]' : 'text-[clamp(2.1rem,6.5vw,4.8rem)]';

  // Al cambiar de temática, el nombre entra desde abajo y la foto hace un leve zoom.
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (reduced || !panel.current) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-name]', { yPercent: 100, duration: 0.8, ease: 'power4.out' });
      gsap.from('[data-cover]', { scale: 1.08, duration: 1.2, ease: 'power3.out' });
      gsap.from('[data-fade]', { opacity: 0, y: 12, duration: 0.6, delay: 0.25, ease: 'power3.out' });
    }, panel);
    return () => ctx.revert();
  }, [idx, reduced, name]);

  return (
    <section className="bg-paper pt-3 md:pt-5 pb-10 md:pb-14">
      <div className="max-w-7xl mx-auto px-3 md:px-6 grid lg:grid-cols-[1.65fr_1fr] gap-3 md:gap-4">
        {/* Panel de la colección */}
        <div
          ref={panel}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className="relative overflow-hidden rounded-[1.75rem] bg-gray-900 min-h-[480px] md:min-h-[560px] lg:min-h-0 lg:h-[min(680px,calc(100svh-var(--store-header-h,116px)-56px))]"
        >
          <img
            key={cover.src}
            data-cover
            src={cover.src}
            srcSet={cover.srcSet}
            sizes="(min-width: 1024px) 62vw, 100vw"
            alt=""
            fetchPriority="high"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/10" aria-hidden="true" />

          {/* Pestañas de temática */}
          {tabs.length > 1 && (
            <div className="absolute top-4 left-4 right-4 flex gap-1.5 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Colecciones">
              {tabs.map((t, i) => (
                <button
                  key={t.tag}
                  type="button"
                  role="tab"
                  aria-selected={i === idx}
                  onClick={() => setIdx(i)}
                  className={`relative overflow-hidden flex-shrink-0 h-9 px-4 rounded-full text-sm font-semibold backdrop-blur-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    i === idx ? 'bg-accent text-accent-ink' : 'bg-black/30 text-white hover:bg-black/45'
                  }`}
                >
                  {t.name}
                  {/* Avance hasta la siguiente colección */}
                  {i === idx && tabs.length > 1 && !reduced && (
                    <span
                      key={idx}
                      aria-hidden="true"
                      className="absolute left-0 bottom-0 h-[3px] bg-accent-ink/40 animate-[heroProgress_7s_linear_forwards]"
                      style={{ animationPlayState: paused ? 'paused' : 'running' }}
                    />
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 p-5 md:p-10">
            {count != null && (
              <p data-fade className="text-sm font-medium text-white/85">
                Colección · {count} {count === 1 ? 'producto' : 'productos'}
              </p>
            )}
            <h1 className="mt-1 overflow-hidden">
              <span
                data-name
                className={`block font-poster font-bold tracking-[-0.035em] uppercase text-white leading-[0.92] ${nameSize}`}
              >
                {name}
              </span>
            </h1>
            <div data-fade className="mt-5 flex flex-wrap gap-2.5">
              <Link
                to={href}
                className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-accent text-accent-ink text-[15px] font-semibold hover:brightness-95 active:scale-[0.98] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
              >
                {tag ? 'Ver colección' : 'Ver catálogo'}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link
                to="/catalog?onSale=1"
                className="inline-flex items-center h-12 px-6 rounded-full border border-white/60 text-white text-[15px] font-semibold hover:bg-white/10 active:scale-[0.98] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
              >
                Ofertas
              </Link>
            </div>
          </div>
        </div>

        {/* Productos de la colección */}
        <div className="flex flex-col min-w-0 min-h-0 lg:h-[min(680px,calc(100svh-var(--store-header-h,116px)-56px))]">
          <div className="flex items-baseline justify-between px-1 pt-1 pb-3">
            <h2 className="text-base font-semibold text-gray-900">{tag ? `En ${name}` : 'Recién llegados'}</h2>
            <Link to={href} className="text-sm font-semibold text-gray-900 underline decoration-accent decoration-2 underline-offset-4">Ver todo</Link>
          </div>
          <ul className={`flex lg:flex-col gap-3 overflow-x-auto lg:overflow-visible snap-x snap-mandatory -mx-3 px-3 lg:mx-0 lg:px-0 scrollbar-hide ${fill ? 'lg:flex-1 lg:min-h-0' : ''}`}>
            {loadingProducts
              ? Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="flex-shrink-0 w-[72%] sm:w-[45%] lg:w-auto lg:flex-1 lg:basis-0 lg:min-h-0 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5 p-3 flex items-center gap-3">
                    <Skeleton className="w-24 lg:w-auto lg:h-full aspect-[4/5] rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-2 py-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/3" /></div>
                  </li>
                ))
              : products.map((p, i) => {
                  const sale = p.hasDiscount && p.salePrice != null ? p.salePrice : null;
                  return (
                    <li key={p.id} className={`flex-shrink-0 w-[72%] sm:w-[45%] lg:w-auto snap-start min-h-0 ${fill ? 'lg:flex-1 lg:basis-0 lg:min-h-0' : ''}`}>
                      <Link
                        to={`/product/${p.id}`}
                        className="group h-full min-h-0 rounded-2xl bg-white hover:bg-white/60 ring-1 ring-black/5 transition-colors p-3 flex items-center gap-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-app-200"
                      >
                        <div className={`w-24 aspect-[4/5] rounded-xl overflow-hidden bg-white flex-shrink-0 ${fill ? 'lg:w-auto lg:h-full' : 'lg:w-[38%] lg:max-w-[150px]'}`}>
                          <div className="w-full h-full transition-transform duration-500 group-hover:scale-[1.04]">
                            <ProductImage src={p.images.front} alt={p.name} width={320} priority={i === 0} />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-semibold text-gray-900 leading-snug line-clamp-2">{p.name}</p>
                          <p className="mt-1 tabular-nums">
                            <span className="text-[15px] font-semibold text-gray-900">{format(sale ?? p.basePrice)}</span>
                            {sale != null && <span className="ml-2 text-sm text-gray-500 line-through"><span className="sr-only">Antes: </span>{format(p.basePrice)}</span>}
                          </p>
                          <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-gray-900">
                            Comprar
                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
          </ul>
        </div>
      </div>
    </section>
  );
}
