import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type TouchEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { ProductImage } from '../products/ProductImage';
import { buttonClass } from '../ui';
import { brandGradient, isDarkBackground, softBrandGradient, type BrandColors, type ResolvedSlide } from './heroModel';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { HeroCarousel, HeroVideo } from './HeroMedia';


interface HeroSliderProps {
  slides: ResolvedSlide[];
  intervalMs: number;
  brandColors: BrandColors;
  className?: string;
}

/**
 * Carta principal del hero: slider de diapositivas (texto a la izquierda, imagen a la derecha;
 * en celular imagen arriba). Autoavance con pausa al pasar el mouse o enfocar, flechas, puntos,
 * teclado y deslizar en táctil. Las diapositivas se apilan en un contenedor de altura fija
 * (sin saltos de layout) y las imágenes se cargan a medida que se acercan.
 */
export function HeroSlider({ slides, intervalMs, brandColors, className = '' }: HeroSliderProps) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [stopped, setStopped] = useState(false); // pausa explícita del usuario
  const reducedMotion = usePrefersReducedMotion();
  const touchX = useRef<number | null>(null);
  // Diapositivas cuyas imágenes ya se pidieron: la actual y la siguiente.
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0, 1]));

  const current = count > 0 ? Math.min(index, count - 1) : 0;
  const go = useCallback((i: number) => {
    if (count < 1) return;
    const n = ((i % count) + count) % count;
    setIndex(n);
    // Se piden las imágenes de la nueva diapositiva y de la siguiente.
    setSeen((s) => (s.has(n) && s.has((n + 1) % count) ? s : new Set([...s, n, (n + 1) % count])));
  }, [count]);
  const next = useCallback(() => go(current + 1), [go, current]);
  const prev = useCallback(() => go(current - 1), [go, current]);

  const playing = count > 1 && !hovered && !focused && !stopped && !reducedMotion;

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(next, intervalMs);
    return () => clearTimeout(t);
  }, [playing, current, intervalMs, next]);

  if (count === 0) return null;

  const onKeyDown = (e: KeyboardEvent) => {
    if (count < 2) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  };
  const onTouchStart = (e: TouchEvent) => { touchX.current = e.touches[0]?.clientX ?? null; };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchX.current == null || count < 2) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) <= 40) return;
    if (dx < 0) next();
    else prev();
  };

  const fade = reducedMotion ? '' : 'transition-opacity duration-700 ease-out';

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Vitrina de la tienda"
      className={`relative overflow-hidden rounded-2xl border border-gray-200 bg-white h-[460px] sm:h-[480px] md:h-[380px] xl:h-full ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false); }}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div aria-live={playing ? 'off' : 'polite'} className="absolute inset-0">
        {slides.map((slide, i) => (
          <Slide
            key={slide.id}
            slide={slide}
            active={i === current}
            playing={i === current && !stopped}
            position={i}
            total={count}
            loadImage={seen.has(i)}
            priority={i === 0}
            brandColors={brandColors}
            fadeClass={fade}
          />
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Diapositiva anterior"
            className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 items-center justify-center rounded-full bg-white/90 border border-gray-200 text-gray-700 shadow-sm hover:bg-white hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Diapositiva siguiente"
            className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 items-center justify-center rounded-full bg-white/90 border border-gray-200 text-gray-700 shadow-sm hover:bg-white hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-full bg-white/90 border border-gray-200 px-2 py-1 shadow-sm">
            {!reducedMotion && (
              <button
                type="button"
                onClick={() => setStopped((s) => !s)}
                aria-label={stopped ? 'Reanudar el avance automático' : 'Pausar el avance automático'}
                className="w-6 h-6 flex items-center justify-center rounded-full text-gray-600 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500"
              >
                {stopped ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
            )}
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Ir a la diapositiva ${i + 1}`}
                aria-current={i === current ? 'true' : undefined}
                className="p-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500"
              >
                <span className={`block h-2 rounded-full transition-all ${i === current ? 'w-5 bg-app-600' : 'w-2 bg-gray-300 hover:bg-gray-400'}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Slide({ slide, active, playing, position, total, loadImage, priority, brandColors, fadeClass }: {
  slide: ResolvedSlide; active: boolean; playing: boolean; position: number; total: number; loadImage: boolean; priority: boolean;
  brandColors: BrandColors; fadeClass: string;
}) {
  const bgType = slide.background;
  const onImage = isDarkBackground(bgType); // texto en blanco
  const titleCls = onImage ? 'text-white' : 'text-gray-900';
  const bgStyle: CSSProperties | undefined =
    bgType === 'brand' ? { background: softBrandGradient(brandColors) }
    : bgType === 'gradient' ? { background: slide.gradient || brandGradient(brandColors) }
    : bgType === 'image' && slide.backgroundImageUrl && loadImage
      ? { backgroundImage: `url("${slide.backgroundImageUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined;
  // Fotos y videos llevan además un degradado para que el texto se lea; el gradiente solo su oscurecido.
  const media = bgType === 'image' || bgType === 'video' || bgType === 'carousel';
  const hasImage = !slide.noMedia && (!!slide.imageUrl || !!slide.media || !!slide.price);

  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${position + 1} de ${total}`}
      aria-hidden={!active}
      inert={!active}
      className={`absolute inset-0 overflow-hidden ${fadeClass} ${active ? 'opacity-100 z-10' : 'opacity-0 z-0'} ${bgType === 'light' ? 'bg-gradient-to-br from-app-50 via-white to-white' : media ? 'bg-gray-800' : ''}`}
      style={bgStyle}
    >
      {loadImage && bgType === 'video' && slide.backgroundVideo && (
        <HeroVideo {...slide.backgroundVideo} playing={playing} />
      )}
      {loadImage && bgType === 'carousel' && slide.backgroundCarousel && (
        <HeroCarousel images={slide.backgroundCarousel.images} intervalMs={slide.backgroundCarousel.intervalMs} transition={slide.backgroundCarousel.transition} playing={playing} />
      )}
      {!!slide.overlayOpacity && <div className="absolute inset-0 bg-black" style={{ opacity: slide.overlayOpacity / 100 }} />}
      {media && <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/75 via-black/50 to-black/10" />}

      <div className={`relative h-full flex ${hasImage ? 'flex-col-reverse md:flex-row' : 'flex-col'} `}>
        {/* Texto */}
        <div className={`flex flex-col justify-center gap-2 md:gap-3 px-5 pt-4 pb-14 md:pt-8 md:pl-16 md:pr-6 lg:pl-20 ${hasImage ? 'md:w-[55%]' : 'flex-1 md:max-w-2xl'} min-w-0`}>
          {slide.badge && (
            <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              onImage ? 'bg-white/20 text-white ring-1 ring-white/30'
              : slide.badgeTone === 'green' ? 'bg-green-100 text-green-800' : 'bg-app-100 text-app-800'
            }`}>
              {slide.badge}
            </span>
          )}
          <h2 className={`font-display font-bold tracking-tight leading-[1.15] text-2xl sm:text-3xl lg:text-[2.6rem] line-clamp-2 md:line-clamp-3 ${titleCls}`}>
            {slide.title}
            {slide.titleLine2 && <span className={`block ${onImage ? 'text-white/90' : 'text-app-700'}`}>{slide.titleLine2}</span>}
          </h2>
          {slide.subtitle && (
            <p className={`text-sm md:text-base line-clamp-2 max-w-md ${onImage ? 'text-white/90' : 'text-gray-600'}`}>{slide.subtitle}</p>
          )}
          {slide.price && (
            <p className="flex items-baseline gap-2">
              <span className={`text-xl md:text-2xl font-semibold ${titleCls}`}>{slide.price.current}</span>
              {slide.price.before && <span className={`text-sm line-through ${onImage ? 'text-white/80' : 'text-gray-500'}`}><span className="sr-only">Antes: </span>{slide.price.before}</span>}
            </p>
          )}
          {slide.buttons.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1 md:pt-2">
              {slide.buttons.map((b, i) => {
                const primary = b.style === 'primary' || (i === 0 && b.style !== 'secondary' && b.style !== 'outline');
                const cls = primary
                  ? buttonClass('primary', 'md')
                  : onImage
                    ? 'inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg bg-white/15 text-white ring-1 ring-white/40 hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white'
                    : buttonClass('secondary', 'md');
                return (
                  <Link key={b.id} to={b.link || '/catalog'} className={`${cls} md:h-11 md:px-5`}>
                    {b.text}
                    {primary && <ArrowRight className="w-4 h-4" />}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Imagen */}
        {hasImage && (
          <div className="relative h-[200px] sm:h-[220px] md:h-auto md:flex-1 flex items-center justify-center px-5 pt-5 md:pt-8 md:pb-14 md:pl-4 md:pr-16 lg:pr-20 min-w-0">
            <div className="relative w-full h-full md:w-auto md:aspect-square md:max-w-full overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200 shadow-sm">
              {loadImage && slide.media?.type === 'video' ? (
                <HeroVideo {...slide.media.video} playing={playing} />
              ) : loadImage && slide.media?.type === 'carousel' ? (
                <HeroCarousel images={slide.media.carousel.images} intervalMs={slide.media.carousel.intervalMs} transition={slide.media.carousel.transition} playing={playing} />
              ) : loadImage ? (
                <ProductImage src={slide.imageUrl} alt={slide.imageAlt} width={800} priority={priority} iconClassName="w-12 h-12" />
              ) : (
                <div className="w-full h-full bg-gray-100" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default HeroSlider;
