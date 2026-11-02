/**
 * Lógica pura del hero "vitrina" de la portada: cartas por defecto, diapositivas efectivas
 * (configuradas, ajustes viejos o armadas desde productos) y tarjetas laterales con producto.
 * No pinta nada: así se prueba sin navegador y la usan la tienda y la configuración.
 */
import type { Product } from '../../types/product';
import type {
  HeroCard, HeroCardBackground, HeroCardButton, HeroSettings, HeroSlide, HeroSlideBackground, HeroSlideBackgroundConfig, HeroSlideMedia,
} from '../../types/settings';
import { HERO_SLIDE_INTERVAL_MS } from '../../types/settings';

export interface BrandColors { primary: string; secondary: string; accent: string }

/** Diapositiva lista para pintar. */
export interface ResolvedSlide {
  id: string;
  badge?: string;
  /** Badge de descuento (verde) en vez del de marca. */
  badgeTone?: 'app' | 'green';
  title: string;
  titleLine2?: string;
  subtitle?: string;
  imageUrl?: string;
  imageAlt: string;
  /** Visual de la derecha que no es imagen (video o carrusel). La imagen va en `imageUrl`. */
  media?: ResolvedMedia;
  /** Sin visual a la derecha (diapositiva configurada con "Ninguno" o sin contenido). */
  noMedia?: boolean;
  background: HeroSlideBackground;
  backgroundImageUrl?: string;
  /** CSS del gradiente propio (fondo `gradient`); sin él se usa el gradiente de marca. */
  gradient?: string;
  backgroundVideo?: ResolvedVideo;
  backgroundCarousel?: ResolvedCarousel;
  /** Oscurecer el fondo (0-80 %). */
  overlayOpacity?: number;
  buttons: Pick<HeroCardButton, 'id' | 'text' | 'link' | 'style'>[];
  /** Precio ya formateado (diapositivas de producto). */
  price?: { current: string; before?: string };
}

export interface ResolvedVideo { url: string; poster?: string; muted: boolean; loop: boolean }
export interface ResolvedCarousel { images: string[]; intervalMs: number; transition: 'fade' | 'slide' }
export type ResolvedMedia = { type: 'video'; video: ResolvedVideo } | { type: 'carousel'; carousel: ResolvedCarousel };

/** Tarjeta lateral lista para pintar. */
export interface ResolvedSideCard {
  card: HeroCard;
  title: string;
  subtitle?: string;
  icon: string;
  link?: string;
  /** Texto del enlace ("Ver ofertas"). */
  cta?: string;
  imageUrl?: string;
  imageAlt: string;
  /** La tarjeta usa su fondo configurado a todo el tamaño (imagen, video, carrusel). */
  fullBleed: boolean;
  price?: { current: string; before?: string; pct?: number };
}

export const MAX_HERO_SLIDES = 5;

/** Gradiente suave de marca (sobre blanco) para el fondo "brand" de una diapositiva. */
export const softBrandGradient = (c: BrandColors) =>
  `linear-gradient(120deg, color-mix(in srgb, ${c.primary} 16%, white) 0%, #ffffff 58%, color-mix(in srgb, ${c.secondary} 12%, white) 100%)`;

/** Gradiente saturado de marca (el de siempre del hero). */
export const brandGradient = (c: BrandColors) => `linear-gradient(to bottom right, ${c.primary}, ${c.secondary}, ${c.accent})`;

/** Gradiente con colores propios (desde → medio → hasta), como el de las cartas. */
export const customGradient = (g: NonNullable<HeroCardBackground['gradientColors']>) =>
  `linear-gradient(to bottom right, ${g.from}, ${g.via || g.to}, ${g.to})`;

/** Id de un video de YouTube (watch, youtu.be, embed o shorts), o null. */
export const getYouTubeId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

/** Fondos oscuros: el texto va en blanco. */
export const isDarkBackground = (t: HeroSlideBackground) => t === 'gradient' || t === 'image' || t === 'video' || t === 'carousel';

const cleanImages = (list?: string[]) => (list ?? []).map((u) => u?.trim()).filter((u): u is string => !!u);

export function resolveVideo(v: Pick<HeroCardBackground, 'videoUrl' | 'videoPoster' | 'videoMuted' | 'videoLoop'>): ResolvedVideo | undefined {
  const url = v.videoUrl?.trim();
  return url ? { url, poster: v.videoPoster || undefined, muted: v.videoMuted ?? true, loop: v.videoLoop ?? true } : undefined;
}

export function resolveCarousel(c: Pick<HeroCardBackground, 'carouselImages' | 'carouselInterval' | 'carouselTransition'>): ResolvedCarousel | undefined {
  const images = cleanImages(c.carouselImages);
  if (images.length === 0) return undefined;
  const ms = Number(c.carouselInterval);
  return { images, intervalMs: Number.isFinite(ms) && ms >= 1000 ? ms : 5000, transition: c.carouselTransition === 'slide' ? 'slide' : 'fade' };
}

type ResolvedBackgroundFields = Pick<ResolvedSlide, 'background' | 'backgroundImageUrl' | 'gradient' | 'backgroundVideo' | 'backgroundCarousel' | 'overlayOpacity'>;

/**
 * Fondo configurado → listo para pintar. Si al tipo le falta su contenido (imagen, video o
 * carrusel vacío) cae a `fallback`, para no dejar texto blanco sobre un fondo vacío.
 */
export function resolveBackground(bg: HeroSlideBackgroundConfig | undefined, fallback: HeroSlideBackground = 'light'): ResolvedBackgroundFields {
  if (!bg) return { background: fallback };
  const overlayOpacity = Math.max(0, Math.min(80, Number(bg.overlayOpacity) || 0));
  switch (bg.type) {
    case 'gradient':
      return { background: 'gradient', gradient: bg.gradientColors?.from ? customGradient(bg.gradientColors) : undefined, overlayOpacity };
    case 'image':
      return bg.imageUrl?.trim() ? { background: 'image', backgroundImageUrl: bg.imageUrl.trim(), overlayOpacity } : { background: fallback };
    case 'video': {
      const video = resolveVideo(bg);
      return video ? { background: 'video', backgroundVideo: video, overlayOpacity } : { background: fallback };
    }
    case 'carousel': {
      const carousel = resolveCarousel(bg);
      return carousel ? { background: 'carousel', backgroundCarousel: carousel, overlayOpacity } : { background: fallback };
    }
    default:
      return { background: bg.type ?? fallback };
  }
}

/** Fondo de una diapositiva: `background` o, en las viejas, `backgroundStyle` / `backgroundImageUrl`. */
export function slideBackgroundConfig(s: HeroSlide): HeroSlideBackgroundConfig {
  if (s.background) return s.background;
  const style = s.backgroundStyle ?? 'light';
  return style === 'image' ? { type: 'image', imageUrl: s.backgroundImageUrl } : { type: style };
}

/** Visual de una diapositiva: `media` o, en las viejas, imagen si hay `imageUrl`. */
export function slideMediaConfig(s: HeroSlide): HeroSlideMedia {
  return s.media ?? { type: s.imageUrl ? 'image' : 'none' };
}

function resolveMedia(s: HeroSlide): Pick<ResolvedSlide, 'imageUrl' | 'media' | 'noMedia'> {
  const m = slideMediaConfig(s);
  if (m.type === 'image' && s.imageUrl) return { imageUrl: s.imageUrl };
  if (m.type === 'video') {
    const video = resolveVideo(m);
    if (video) return { media: { type: 'video', video } };
  }
  if (m.type === 'carousel') {
    const carousel = resolveCarousel(m);
    if (carousel) return { media: { type: 'carousel', carousel } };
  }
  return { noMedia: true };
}

/** % de descuento real entre el precio base y el de venta (redondeado). */
export function discountPercent(base: number, sale: number | null | undefined): number {
  if (!base || sale == null || sale >= base) return 0;
  return Math.round(((base - sale) / base) * 100);
}

const salePriceOf = (p: Product): number | null => (p.hasDiscount && p.salePrice != null ? Number(p.salePrice) : null);

/** Producto con el mayor descuento vigente (o null si ninguno tiene descuento). */
export function topDiscount(products: Product[]): Product | null {
  let best: Product | null = null;
  let bestPct = 0;
  for (const p of products) {
    const pct = discountPercent(Number(p.basePrice), salePriceOf(p));
    if (pct > bestPct) { best = p; bestPct = pct; }
  }
  return best;
}

const priceOf = (p: Product, format: (n: number) => string) => {
  const sale = salePriceOf(p);
  const base = Number(p.basePrice);
  const pct = discountPercent(base, sale);
  return {
    current: format(sale ?? base),
    before: sale != null && pct > 0 ? format(base) : undefined,
    pct: pct > 0 ? pct : undefined,
  };
};

/** Cartas que se usan cuando no hay nada guardado. La principal arranca sin diapositivas (= productos). */
export function getDefaultHeroCards(brandColors: BrandColors, enableCustomizer: boolean): HeroCard[] {
  return [
    {
      id: 'main',
      position: 'main',
      order: 0,
      title: 'Diseñado por ti,',
      titleLine2: 'hecho por Vexa',
      subtitle: 'Personaliza camisetas, hoodies y más con tus propios diseños.',
      showSubtitle: true,
      showBadge: false,
      buttons: [
        { id: 'btn-1', text: 'Ver catálogo', link: '/catalog', style: 'primary', icon: 'shoppingBag', isActive: true },
      ],
      background: { type: 'gradient', overlayOpacity: 0 },
      isActive: true,
      slides: [],
    },
    {
      id: 'side-1',
      position: 'side',
      order: 1,
      title: enableCustomizer ? 'Personaliza' : 'Novedades',
      subtitle: enableCustomizer ? 'Sube tu diseño' : 'Lo último en llegar',
      showSubtitle: true,
      showBadge: false,
      icon: enableCustomizer ? 'palette' : 'sparkles',
      buttons: [
        {
          id: 'btn-side-1',
          text: enableCustomizer ? 'Personalizar' : 'Ver novedades',
          link: enableCustomizer ? '/customize' : '/catalog?sort=newest',
          style: 'primary',
          isActive: true,
        },
      ],
      background: { type: 'gradient', gradientColors: { from: brandColors.secondary, to: brandColors.secondary }, overlayOpacity: 20 },
      isActive: true,
    },
    {
      id: 'side-2',
      position: 'side',
      order: 2,
      title: 'Ofertas',
      subtitle: 'Descuentos vigentes',
      showSubtitle: true,
      showBadge: false,
      icon: 'percent',
      buttons: [{ id: 'btn-side-2', text: 'Ver ofertas', link: '/catalog?onSale=1', style: 'primary', isActive: true }],
      background: { type: 'gradient', gradientColors: { from: brandColors.accent, to: brandColors.accent }, overlayOpacity: 20 },
      isActive: true,
    },
  ];
}

/** Intervalo efectivo del autoavance (mínimo 3 s). */
export function heroInterval(hero?: Partial<HeroSettings>): number {
  const ms = Number(hero?.slideIntervalMs);
  return Number.isFinite(ms) && ms >= 3000 ? ms : HERO_SLIDE_INTERVAL_MS;
}

const activeButtons = (buttons: HeroCardButton[] | undefined) =>
  (buttons ?? []).filter((b) => b.isActive && b.text?.trim()).slice(0, 2).map(({ id, text, link, style }) => ({ id, text, link, style }));

/** Diapositiva configurada → lista para pintar. */
function fromSlide(s: HeroSlide): ResolvedSlide {
  return {
    id: s.id,
    badge: s.badge?.trim() || undefined,
    title: s.title,
    titleLine2: s.titleLine2 || undefined,
    subtitle: s.subtitle || undefined,
    ...resolveMedia(s),
    imageAlt: [s.title, s.titleLine2].filter(Boolean).join(' '),
    ...resolveBackground(slideBackgroundConfig(s)),
    buttons: activeButtons(s.buttons),
  };
}

/**
 * Carta principal del formato viejo (sin `slides`) → una diapositiva con el mismo fondo: gradiente
 * con sus colores, imagen, video o carrusel, con su oscurecido. Solo el gradiente sin colores
 * propios (el de las cartas por defecto) pasa al gradiente suave de marca.
 */
export function legacySlideFromCard(card: HeroCard): ResolvedSlide {
  const bg = card.background ?? { type: 'gradient' };
  const background: ResolvedBackgroundFields = bg.type === 'gradient' && !bg.gradientColors?.from
    ? { background: 'brand' }
    : resolveBackground(bg, 'brand');
  return {
    id: `${card.id}-legacy`,
    badge: card.showBadge ? card.badge?.trim() || undefined : undefined,
    title: card.title,
    titleLine2: card.titleLine2 || undefined,
    subtitle: card.showSubtitle ? card.subtitle || undefined : undefined,
    imageAlt: [card.title, card.titleLine2].filter(Boolean).join(' '),
    noMedia: true,
    ...background,
    buttons: activeButtons(card.buttons),
  };
}

/** Producto → diapositiva de vitrina. */
export function productSlide(p: Product, format: (n: number) => string, origin: 'featured' | 'new'): ResolvedSlide {
  const price = priceOf(p, format);
  return {
    id: `product-${p.id}`,
    badge: price.pct ? `-${price.pct}%` : origin === 'featured' ? 'Destacado' : 'Nuevo',
    badgeTone: price.pct ? 'green' : 'app',
    title: p.name,
    subtitle: p.categoryName || undefined,
    imageUrl: p.images?.front || undefined,
    imageAlt: p.name,
    background: 'light',
    buttons: [
      { id: `view-${p.id}`, text: 'Ver producto', link: `/product/${p.id}`, style: 'primary' },
      { id: `catalog-${p.id}`, text: 'Ver catálogo', link: '/catalog', style: 'secondary' },
    ],
    price: { current: price.current, before: price.before },
  };
}

/**
 * Diapositivas efectivas de la carta principal:
 * 1. Diapositivas configuradas y activas → esas.
 * 2. Si no hay: carta del formato viejo (sin campo `slides`) como primera, y luego (si
 *    `autoFromFeatured`, por defecto sí) los destacados, o si no hay destacados los más nuevos.
 * 3. Si aun así no queda nada → el contenido de la carta como diapositiva de presentación.
 */
export function buildHeroSlides(opts: {
  mainCard: HeroCard;
  autoFromFeatured?: boolean;
  featured?: Product[] | null;
  newest?: Product[] | null;
  format: (n: number) => string;
}): ResolvedSlide[] {
  const { mainCard, format } = opts;
  const configured = (mainCard.slides ?? []).filter((s) => s.isActive && (s.title?.trim() || s.imageUrl || s.media?.type === 'video' || s.media?.type === 'carousel'));
  if (configured.length > 0) return configured.slice(0, 8).map(fromSlide);

  const slides: ResolvedSlide[] = [];
  if (mainCard.slides === undefined) slides.push(legacySlideFromCard(mainCard));

  if (opts.autoFromFeatured !== false) {
    const featured = opts.featured ?? [];
    const source = featured.length > 0 ? featured : opts.newest ?? [];
    const origin = featured.length > 0 ? 'featured' : 'new';
    for (const p of source.slice(0, MAX_HERO_SLIDES)) slides.push(productSlide(p, format, origin));
  }

  return slides.length > 0 ? slides : [legacySlideFromCard(mainCard)];
}

const buttonOf = (card: HeroCard) => card.buttons?.find((b) => b.isActive) ?? card.buttons?.[0];

/**
 * Tarjetas laterales con producto. La de ofertas muestra el producto con mayor descuento;
 * si no hay ofertas se convierte en "Novedades" con el más nuevo. La de personalizar usa su
 * imagen o la de una plantilla. Las que tienen fondo de imagen/video/carrusel se pintan como antes.
 */
export function resolveSideCards(opts: {
  cards: HeroCard[];
  sale?: Product[] | null;
  newest?: Product[] | null;
  featured?: Product[] | null;
  format: (n: number) => string;
}): ResolvedSideCard[] {
  const { format } = opts;
  const newest = opts.newest ?? [];
  const pool = [...(opts.featured ?? []), ...newest];
  const best = topDiscount(opts.sale ?? []);

  return opts.cards.map((card) => {
    const link = buttonOf(card)?.link;
    const bgType = card.background?.type ?? 'gradient';
    const fullBleed = bgType !== 'gradient' && !!(card.background.imageUrl || card.background.videoUrl || card.background.carouselImages?.some((u) => u?.trim()));
    const base: ResolvedSideCard = {
      card,
      title: card.title,
      subtitle: card.showSubtitle === false ? undefined : card.subtitle,
      icon: card.icon || 'sparkles',
      link,
      cta: buttonOf(card)?.text || undefined,
      imageUrl: card.imageUrl || undefined,
      imageAlt: card.title,
      fullBleed,
    };
    if (fullBleed) return base;

    const isSale = /onSale/i.test(link ?? '') || card.icon === 'percent';
    const isCustomize = /customi[sz]/i.test(link ?? '');

    if (isSale) {
      if (best) {
        return { ...base, imageUrl: base.imageUrl || best.images?.front, imageAlt: best.name, price: priceOf(best, format), subtitle: best.name };
      }
      // Sin ofertas: la tarjeta pasa a Novedades con el producto más nuevo (si sigue cargando, se queda igual).
      if (opts.sale && newest[0]) {
        const p = newest[0];
        return { ...base, title: 'Novedades', subtitle: p.name, icon: 'sparkles', link: '/catalog?sort=newest', cta: 'Ver novedades', imageUrl: p.images?.front, imageAlt: p.name, price: priceOf(p, format) };
      }
      return base;
    }

    if (base.imageUrl) return base;
    // Personalizar: una plantilla o, si no hay, el último del grupo (para no repetir la 1.ª diapositiva).
    const featured = opts.featured ?? [];
    const pick = isCustomize
      ? pool.find((p) => p.isTemplate) ?? featured[featured.length - 1] ?? newest[Math.min(1, newest.length - 1)]
      : newest[0] ?? pool[0];
    return pick ? { ...base, imageUrl: pick.images?.front, imageAlt: isCustomize ? card.title : pick.name } : base;
  });
}
