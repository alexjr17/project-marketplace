import { describe, expect, it } from 'vitest';
import type { Product } from '../../types/product';
import type { HeroCard, HeroSlide } from '../../types/settings';
import { buildHeroSlides, discountPercent, getDefaultHeroCards, heroInterval, resolveSideCards, topDiscount } from './heroModel';

const brand = { primary: '#7c3aed', secondary: '#ec4899', accent: '#f59e0b' };
const format = (n: number) => `$${n}`;

const product = (id: number, extra: Partial<Product> = {}): Product => ({
  id,
  name: `Producto ${id}`,
  description: '',
  basePrice: 100000,
  images: { front: `https://img.test/${id}.jpg` },
  colors: [],
  sizes: [],
  featured: false,
  stock: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...extra,
} as Product);

const onSale = (id: number, salePrice: number, extra: Partial<Product> = {}) => product(id, { hasDiscount: true, salePrice, ...extra });

/** Carta principal guardada con el formato viejo (sin `slides`). */
const legacyMain = (extra: Partial<HeroCard> = {}): HeroCard => ({
  id: 'main',
  position: 'main',
  order: 0,
  title: 'Diseñado por ti,',
  titleLine2: 'hecho por Vexa',
  subtitle: 'Personaliza camisetas',
  showSubtitle: true,
  showBadge: true,
  badge: 'Nuevo',
  buttons: [
    { id: 'b1', text: 'Crear diseño', link: '/customizer', style: 'primary', isActive: true },
    { id: 'b2', text: 'Oculto', link: '/x', style: 'secondary', isActive: false },
  ],
  background: { type: 'gradient', overlayOpacity: 0 },
  isActive: true,
  ...extra,
});

describe('descuentos', () => {
  it('discountPercent redondea y es 0 sin descuento real', () => {
    expect(discountPercent(100000, 75000)).toBe(25);
    expect(discountPercent(100000, 100000)).toBe(0);
    expect(discountPercent(100000, null)).toBe(0);
    expect(discountPercent(0, 10)).toBe(0);
  });

  it('topDiscount elige el mayor % vigente', () => {
    const best = topDiscount([onSale(1, 90000), onSale(2, 60000), product(3), onSale(4, 70000, { hasDiscount: false })]);
    expect(best?.id).toBe(2);
    expect(topDiscount([product(1)])).toBeNull();
  });
});

describe('buildHeroSlides: armado automático desde productos', () => {
  const defaultMain = getDefaultHeroCards(brand, true)[0];

  it('sin nada guardado usa los destacados con precio, tachado y % si tienen descuento', () => {
    const slides = buildHeroSlides({ mainCard: defaultMain, featured: [onSale(1, 75000), product(2)], newest: [product(9)], format });
    expect(slides.map((s) => s.id)).toEqual(['product-1', 'product-2']);
    const [a, b] = slides;
    expect(a).toMatchObject({ badge: '-25%', badgeTone: 'green', title: 'Producto 1', imageUrl: 'https://img.test/1.jpg', price: { current: '$75000', before: '$100000' } });
    expect(a.buttons.map((x) => [x.text, x.link])).toEqual([['Ver producto', '/product/1'], ['Ver catálogo', '/catalog']]);
    expect(b).toMatchObject({ badge: 'Destacado', badgeTone: 'app', price: { current: '$100000', before: undefined } });
  });

  it('si no hay destacados usa los más nuevos, máximo 5', () => {
    const newest = [1, 2, 3, 4, 5, 6, 7].map((i) => product(i));
    const slides = buildHeroSlides({ mainCard: defaultMain, featured: [], newest, format });
    expect(slides).toHaveLength(5);
    expect(slides[0].badge).toBe('Nuevo');
  });

  it('sin productos queda el contenido de la carta como presentación', () => {
    const slides = buildHeroSlides({ mainCard: defaultMain, featured: [], newest: [], format });
    expect(slides).toHaveLength(1);
    expect(slides[0]).toMatchObject({ title: 'Diseñado por ti,', titleLine2: 'hecho por Vexa', background: 'brand' });
  });

  it('con el switch apagado no usa productos', () => {
    const slides = buildHeroSlides({ mainCard: defaultMain, autoFromFeatured: false, featured: [product(1)], newest: [product(2)], format });
    expect(slides).toHaveLength(1);
    expect(slides[0].id).toBe('main-legacy');
  });

  it('las diapositivas configuradas mandan (solo las activas, en su orden)', () => {
    const main: HeroCard = {
      ...defaultMain,
      slides: [
        { id: 'x', title: 'Colección', titleLine2: 'verano', imageUrl: 'https://img.test/x.jpg', backgroundStyle: 'brand', buttons: [{ id: 'b', text: 'Ver', link: '/c', style: 'primary', isActive: true }], isActive: true },
        { id: 'y', title: 'Oculta', buttons: [], isActive: false },
        { id: 'z', title: 'Fondo sin imagen', backgroundStyle: 'image', buttons: [], isActive: true },
      ],
    };
    const slides = buildHeroSlides({ mainCard: main, featured: [product(1)], format });
    expect(slides.map((s) => s.id)).toEqual(['x', 'z']);
    expect(slides[0]).toMatchObject({ title: 'Colección', titleLine2: 'verano', background: 'brand' });
    // "imagen de fondo" sin imagen cae al fondo claro
    expect(slides[1].background).toBe('light');
  });
});

describe('diapositivas configuradas: fondos y visual', () => {
  const base = getDefaultHeroCards(brand, true)[0];
  const withSlide = (slide: Partial<HeroSlide>) =>
    buildHeroSlides({ mainCard: { ...base, slides: [{ id: 's', title: 'T', buttons: [], isActive: true, ...slide }] }, format })[0];

  it('fondo de video, carrusel y gradiente propio con su oscurecido (máx. 80 %)', () => {
    expect(withSlide({ background: { type: 'video', videoUrl: 'https://cdn.test/a.webm', overlayOpacity: 95 } }))
      .toMatchObject({ background: 'video', backgroundVideo: { url: 'https://cdn.test/a.webm', muted: true, loop: true }, overlayOpacity: 80 });
    expect(withSlide({ background: { type: 'carousel', carouselImages: ['https://img.test/1.jpg'] } }))
      .toMatchObject({ background: 'carousel', backgroundCarousel: { images: ['https://img.test/1.jpg'], intervalMs: 5000, transition: 'fade' } });
    expect(withSlide({ background: { type: 'gradient', gradientColors: { from: '#000000', via: '#ff0000', to: '#ffffff' } } }))
      .toMatchObject({ background: 'gradient', gradient: 'linear-gradient(to bottom right, #000000, #ff0000, #ffffff)' });
    expect(withSlide({ background: { type: 'gradient' } })).toMatchObject({ background: 'gradient', gradient: undefined });
  });

  it('visual de la derecha: imagen, video, carrusel o ninguno', () => {
    expect(withSlide({ imageUrl: 'https://img.test/a.jpg', media: { type: 'image' } })).toMatchObject({ imageUrl: 'https://img.test/a.jpg' });
    expect(withSlide({ media: { type: 'video', videoUrl: 'https://youtu.be/abc' } }))
      .toMatchObject({ media: { type: 'video', video: { url: 'https://youtu.be/abc' } } });
    expect(withSlide({ media: { type: 'carousel', carouselImages: ['https://img.test/1.jpg', 'https://img.test/2.jpg'], carouselInterval: 4000 } }))
      .toMatchObject({ media: { type: 'carousel', carousel: { images: ['https://img.test/1.jpg', 'https://img.test/2.jpg'], intervalMs: 4000 } } });
    expect(withSlide({ imageUrl: 'https://img.test/a.jpg', media: { type: 'none' } })).toMatchObject({ noMedia: true });
  });

  it('una diapositiva vieja (backgroundStyle + imageUrl) se lee igual que antes', () => {
    expect(withSlide({ imageUrl: 'https://img.test/a.jpg', backgroundStyle: 'image', backgroundImageUrl: 'https://img.test/bg.jpg' }))
      .toMatchObject({ imageUrl: 'https://img.test/a.jpg', background: 'image', backgroundImageUrl: 'https://img.test/bg.jpg' });
    expect(withSlide({ backgroundStyle: 'brand' })).toMatchObject({ background: 'brand', noMedia: true });
  });
});

describe('compatibilidad con ajustes viejos', () => {
  it('carta principal sin `slides`: su contenido es la primera diapositiva y luego los productos', () => {
    const slides = buildHeroSlides({ mainCard: legacyMain(), featured: [product(1)], format });
    expect(slides.map((s) => s.id)).toEqual(['main-legacy', 'product-1']);
    expect(slides[0]).toMatchObject({
      badge: 'Nuevo', title: 'Diseñado por ti,', titleLine2: 'hecho por Vexa', subtitle: 'Personaliza camisetas',
      background: 'brand', // el gradiente saturado pasa al gradiente suave de marca
    });
    expect(slides[0].buttons.map((b) => b.text)).toEqual(['Crear diseño']); // solo botones activos
  });

  it('fondo de imagen, carrusel o video del formato viejo se conserva tal cual', () => {
    const one = (background: HeroCard['background']) => buildHeroSlides({ mainCard: legacyMain({ background }), autoFromFeatured: false, format })[0];
    expect(one({ type: 'image', imageUrl: 'https://img.test/bg.jpg', overlayOpacity: 30 }))
      .toMatchObject({ background: 'image', backgroundImageUrl: 'https://img.test/bg.jpg', overlayOpacity: 30, noMedia: true });
    expect(one({ type: 'carousel', carouselImages: ['', 'https://img.test/c1.jpg', 'https://img.test/c2.jpg'], carouselInterval: 3000, carouselTransition: 'slide' }))
      .toMatchObject({ background: 'carousel', backgroundCarousel: { images: ['https://img.test/c1.jpg', 'https://img.test/c2.jpg'], intervalMs: 3000, transition: 'slide' } });
    expect(one({ type: 'video', videoUrl: 'https://cdn.test/v.mp4', videoPoster: 'https://img.test/p.jpg', videoMuted: false }))
      .toMatchObject({ background: 'video', backgroundVideo: { url: 'https://cdn.test/v.mp4', poster: 'https://img.test/p.jpg', muted: false, loop: true } });
  });

  it('el gradiente con colores propios se respeta; sin colores pasa a la marca suave', () => {
    const custom = buildHeroSlides({ mainCard: legacyMain({ background: { type: 'gradient', gradientColors: { from: '#111111', to: '#222222' } } }), autoFromFeatured: false, format })[0];
    expect(custom).toMatchObject({ background: 'gradient', gradient: 'linear-gradient(to bottom right, #111111, #222222, #222222)' });
    expect(buildHeroSlides({ mainCard: legacyMain(), autoFromFeatured: false, format })[0].background).toBe('brand');
  });

  it('fondo de video o carrusel vacío cae al gradiente de marca (no queda texto blanco sobre nada)', () => {
    expect(buildHeroSlides({ mainCard: legacyMain({ background: { type: 'video', videoUrl: ' ' } }), autoFromFeatured: false, format })[0].background).toBe('brand');
    expect(buildHeroSlides({ mainCard: legacyMain({ background: { type: 'carousel', carouselImages: [''] } }), autoFromFeatured: false, format })[0].background).toBe('brand');
  });

  it('respeta showBadge/showSubtitle apagados', () => {
    const [s] = buildHeroSlides({ mainCard: legacyMain({ showBadge: false, showSubtitle: false }), autoFromFeatured: false, format });
    expect(s.badge).toBeUndefined();
    expect(s.subtitle).toBeUndefined();
  });

  it('el intervalo viejo (sin campo) usa 6 s y no baja de 3 s', () => {
    expect(heroInterval(undefined)).toBe(6000);
    expect(heroInterval({})).toBe(6000);
    expect(heroInterval({ slideIntervalMs: 1000 })).toBe(6000);
    expect(heroInterval({ slideIntervalMs: 8000 })).toBe(8000);
  });

  it('las cartas por defecto traen la principal sin diapositivas y dos laterales', () => {
    const cards = getDefaultHeroCards(brand, false);
    expect(cards[0].slides).toEqual([]);
    expect(cards.filter((c) => c.position === 'side').map((c) => c.title)).toEqual(['Novedades', 'Ofertas']);
  });
});

describe('resolveSideCards', () => {
  const [, customize, offers] = getDefaultHeroCards(brand, true);

  it('ofertas muestra el producto con mayor descuento y su precio', () => {
    const [r] = resolveSideCards({ cards: [offers], sale: [onSale(1, 90000), onSale(2, 50000)], newest: [product(3)], format });
    expect(r).toMatchObject({ title: 'Ofertas', subtitle: 'Producto 2', imageUrl: 'https://img.test/2.jpg', price: { current: '$50000', before: '$100000', pct: 50 }, cta: 'Ver ofertas' });
  });

  it('sin ofertas pasa a Novedades con el más nuevo', () => {
    const [r] = resolveSideCards({ cards: [offers], sale: [], newest: [product(7), product(8)], format });
    expect(r).toMatchObject({ title: 'Novedades', subtitle: 'Producto 7', link: '/catalog?sort=newest', cta: 'Ver novedades', imageUrl: 'https://img.test/7.jpg' });
  });

  it('mientras cargan las ofertas no cambia la tarjeta', () => {
    const [r] = resolveSideCards({ cards: [offers], sale: null, newest: [product(7)], format });
    expect(r.title).toBe('Ofertas');
  });

  it('personaliza usa su imagen configurada, si no una plantilla', () => {
    expect(resolveSideCards({ cards: [{ ...customize, imageUrl: 'https://img.test/mia.jpg' }], newest: [product(1)], format })[0].imageUrl).toBe('https://img.test/mia.jpg');
    expect(resolveSideCards({ cards: [customize], newest: [product(1), product(2, { isTemplate: true })], format })[0].imageUrl).toBe('https://img.test/2.jpg');
  });

  it('una lateral vieja con fondo de imagen se pinta como antes (fullBleed)', () => {
    const old: HeroCard = { ...customize, background: { type: 'image', imageUrl: 'https://img.test/bg.jpg' } };
    expect(resolveSideCards({ cards: [old], newest: [product(1)], format })[0]).toMatchObject({ fullBleed: true, imageUrl: undefined });
  });
});
