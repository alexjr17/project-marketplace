import { createElement } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ProductImage } from '../products/ProductImage';
import { featureIcon } from './featureIcons';
import { HeroCard } from './HeroCard';
import type { ResolvedSideCard } from './heroModel';

/**
 * Tarjeta lateral del hero: blanca, texto a la izquierda e imagen (configurada o de un producto)
 * a la derecha; en celular, imagen arriba y texto compacto. Toda la tarjeta es el enlace.
 * Si la tarjeta tiene un fondo de imagen/video/carrusel configurado, se pinta como antes.
 */
export function HeroSideCard({ item, className = '' }: { item: ResolvedSideCard; className?: string }) {
  if (item.fullBleed) return <HeroCard card={item.card} className={`min-h-[140px] ${className}`} />;

  const icon = (className: string, strokeWidth?: number) => createElement(featureIcon(item.icon), { className, strokeWidth });
  const hasImage = !!item.imageUrl;
  const body = (
    <>
      <div className="flex-1 min-w-0 flex flex-col gap-1 p-3 md:p-4">
        <span className="hidden md:inline-flex w-8 h-8 rounded-lg bg-app-50 text-app-700 items-center justify-center mb-1">
          {icon('w-4 h-4')}
        </span>
        <h3 className="font-semibold text-gray-900 text-sm md:text-lg leading-tight truncate">{item.title}</h3>
        {item.subtitle && <p className="text-xs md:text-sm text-gray-500 line-clamp-1 md:line-clamp-2">{item.subtitle}</p>}
        {item.price && (
          <p className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-sm md:text-base font-semibold text-gray-900">{item.price.current}</span>
            {item.price.before && <span className="text-xs text-gray-400 line-through">{item.price.before}</span>}
          </p>
        )}
        {item.cta && (
          <span className="mt-auto hidden md:inline-flex items-center gap-1 pt-1 text-sm font-medium text-app-700">
            {item.cta}
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        )}
      </div>

      <div className="relative order-first md:order-none aspect-[16/9] md:aspect-auto md:w-[42%] md:max-w-[180px] flex-shrink-0 md:p-3 md:pl-0">
        <div className="relative w-full h-full overflow-hidden md:rounded-xl bg-app-50">
          {hasImage ? (
            <ProductImage src={item.imageUrl} alt={item.imageAlt} width={400} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-app-300" aria-hidden="true">
              {icon('w-10 h-10', 1.5)}
            </div>
          )}
          {item.price?.pct && (
            <span className="absolute top-2 left-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 ring-1 ring-white/70">
              -{item.price.pct}%
            </span>
          )}
        </div>
      </div>
    </>
  );

  const cls = `group relative flex flex-col md:flex-row overflow-hidden rounded-2xl border border-gray-200 bg-white hover:shadow-md transition-shadow min-w-0 ${className}`;
  return item.link ? (
    <Link to={item.link} className={`${cls} focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500`} aria-label={[item.title, item.subtitle].filter(Boolean).join(': ')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default HeroSideCard;
