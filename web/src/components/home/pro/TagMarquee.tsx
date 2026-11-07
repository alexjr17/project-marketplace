import { Link } from 'react-router-dom';
import { tagHref, useTags } from './useTags';

/**
 * Tira de temáticas que corre de lado (se detiene al pasar el mouse). Con menos movimiento es
 * una fila que se desliza a mano.
 */
export function TagMarquee({ reduced }: { reduced: boolean }) {
  const { tags } = useTags();
  if (tags.length < 2) return null;

  const row = (hidden: boolean) => (
    <ul className="flex items-center gap-8 md:gap-12 pr-8 md:pr-12 flex-shrink-0" aria-hidden={hidden || undefined}>
      {tags.map((t) => (
        <li key={t.tag} className="flex items-center gap-8 md:gap-12">
          <Link
            to={tagHref(t.tag)}
            tabIndex={hidden ? -1 : undefined}
            className="group flex items-baseline gap-2 whitespace-nowrap focus:outline-none focus-visible:underline"
          >
            <span className="font-poster font-bold tracking-[-0.035em] uppercase text-3xl md:text-5xl leading-none text-gray-900 transition-colors group-hover:text-app-600">
              {t.name}
            </span>
            <span className="text-sm text-gray-500 tabular-nums">{t.productCount}</span>
          </Link>
          <span className="w-2.5 h-2.5 rounded-full bg-accent" aria-hidden="true" />
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-label="Temáticas" className="border-y border-black/10 bg-paper py-5 md:py-7 overflow-hidden">
      {reduced ? (
        <div className="overflow-x-auto scrollbar-hide px-4">{row(false)}</div>
      ) : (
        <div className="flex w-max animate-[marquee_38s_linear_infinite] hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]">
          {row(false)}
          {row(true)}
        </div>
      )}
    </section>
  );
}
