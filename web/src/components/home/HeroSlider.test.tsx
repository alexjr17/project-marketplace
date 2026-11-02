import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HeroSlider } from './HeroSlider';
import type { ResolvedSlide } from './heroModel';

const brand = { primary: '#7c3aed', secondary: '#ec4899', accent: '#f59e0b' };

const slide = (n: number, extra: Partial<ResolvedSlide> = {}): ResolvedSlide => ({
  id: `s${n}`,
  title: `Título ${n}`,
  imageAlt: `Imagen ${n}`,
  imageUrl: `https://img.test/${n}.jpg`,
  background: 'light',
  buttons: [{ id: `b${n}`, text: `Botón ${n}`, link: `/product/${n}`, style: 'primary' }],
  ...extra,
});

const renderSlider = (slides: ResolvedSlide[], intervalMs = 6000) =>
  render(
    <MemoryRouter>
      <HeroSlider slides={slides} intervalMs={intervalMs} brandColors={brand} />
    </MemoryRouter>,
  );

const carousel = () => document.querySelector('[aria-roledescription="carousel"]') as HTMLElement;
/** Índice (base 1) de la diapositiva visible, según el punto marcado. */
const currentDot = () => {
  const dots = screen.getAllByRole('button', { name: /Ir a la diapositiva/ });
  return dots.findIndex((d) => d.getAttribute('aria-current') === 'true') + 1;
};
const visibleSlide = () => {
  const groups = Array.from(document.querySelectorAll('[aria-roledescription="slide"]'));
  return groups.find((g) => g.getAttribute('aria-hidden') === 'false')?.getAttribute('aria-label');
};

describe('HeroSlider', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('es accesible: carrusel con diapositivas etiquetadas y solo la actual visible', () => {
    renderSlider([slide(1), slide(2), slide(3)]);
    expect(carousel()).toHaveAttribute('aria-label');
    expect(document.querySelectorAll('[aria-roledescription="slide"]')).toHaveLength(3);
    expect(visibleSlide()).toBe('1 de 3');
    expect(screen.getByRole('button', { name: 'Diapositiva anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Diapositiva siguiente' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Título 1' })).toBeInTheDocument();
  });

  it('avanza solo con el intervalo configurado y vuelve al inicio', () => {
    renderSlider([slide(1), slide(2), slide(3)], 4000);
    expect(currentDot()).toBe(1);
    act(() => { vi.advanceTimersByTime(3999); });
    expect(currentDot()).toBe(1);
    act(() => { vi.advanceTimersByTime(1); });
    expect(currentDot()).toBe(2);
    act(() => { vi.advanceTimersByTime(4000); });
    expect(currentDot()).toBe(3);
    act(() => { vi.advanceTimersByTime(4000); });
    expect(currentDot()).toBe(1);
  });

  it('se pausa al pasar el mouse y sigue al salir; mientras está en pausa anuncia los cambios', () => {
    renderSlider([slide(1), slide(2)]);
    const live = carousel().querySelector('[aria-live]')!;
    expect(live).toHaveAttribute('aria-live', 'off');
    fireEvent.mouseEnter(carousel());
    expect(live).toHaveAttribute('aria-live', 'polite');
    act(() => { vi.advanceTimersByTime(20000); });
    expect(currentDot()).toBe(1);
    fireEvent.mouseLeave(carousel());
    act(() => { vi.advanceTimersByTime(6000); });
    expect(currentDot()).toBe(2);
  });

  it('se pausa al enfocar un elemento del slider', () => {
    renderSlider([slide(1), slide(2)]);
    fireEvent.focus(screen.getByRole('link', { name: /Botón 1/ }));
    act(() => { vi.advanceTimersByTime(20000); });
    expect(currentDot()).toBe(1);
  });

  it('botón de pausa detiene y reanuda el avance', () => {
    renderSlider([slide(1), slide(2)]);
    fireEvent.click(screen.getByRole('button', { name: 'Pausar el avance automático' }));
    fireEvent.blur(screen.getByRole('button', { name: 'Reanudar el avance automático' }));
    act(() => { vi.advanceTimersByTime(20000); });
    expect(currentDot()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar el avance automático' }));
    fireEvent.blur(screen.getByRole('button', { name: 'Pausar el avance automático' }));
    act(() => { vi.advanceTimersByTime(6000); });
    expect(currentDot()).toBe(2);
  });

  it('navega con flechas del teclado, botones y puntos', () => {
    renderSlider([slide(1), slide(2), slide(3)]);
    fireEvent.keyDown(carousel(), { key: 'ArrowRight' });
    expect(visibleSlide()).toBe('2 de 3');
    fireEvent.keyDown(carousel(), { key: 'ArrowLeft' });
    fireEvent.keyDown(carousel(), { key: 'ArrowLeft' });
    expect(visibleSlide()).toBe('3 de 3');
    fireEvent.click(screen.getByRole('button', { name: 'Ir a la diapositiva 2' }));
    expect(visibleSlide()).toBe('2 de 3');
    expect(currentDot()).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Diapositiva siguiente' }));
    expect(visibleSlide()).toBe('3 de 3');
    fireEvent.click(screen.getByRole('button', { name: 'Diapositiva anterior' }));
    expect(visibleSlide()).toBe('2 de 3');
  });

  it('deslizar en táctil cambia de diapositiva (y un toque corto no)', () => {
    renderSlider([slide(1), slide(2), slide(3)]);
    fireEvent.touchStart(carousel(), { touches: [{ clientX: 300 }] });
    fireEvent.touchEnd(carousel(), { changedTouches: [{ clientX: 180 }] });
    expect(visibleSlide()).toBe('2 de 3');
    fireEvent.touchStart(carousel(), { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(carousel(), { changedTouches: [{ clientX: 120 }] });
    expect(visibleSlide()).toBe('2 de 3');
    fireEvent.touchStart(carousel(), { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(carousel(), { changedTouches: [{ clientX: 220 }] });
    expect(visibleSlide()).toBe('1 de 3');
  });

  it('con prefers-reduced-motion no avanza solo', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener: () => {}, removeEventListener: () => {} }));
    try {
      renderSlider([slide(1), slide(2)]);
      act(() => { vi.advanceTimersByTime(30000); });
      expect(currentDot()).toBe(1);
      expect(screen.queryByRole('button', { name: /avance automático/ })).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('una sola diapositiva: sin flechas ni puntos', () => {
    renderSlider([slide(1)]);
    expect(screen.queryByRole('button', { name: /Diapositiva siguiente/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Ir a la diapositiva/ })).toBeNull();
  });

  it('carga la imagen de la primera con prioridad y difiere las lejanas', () => {
    renderSlider([slide(1), slide(2), slide(3), slide(4)]);
    const img1 = screen.getByAltText('Imagen 1');
    expect(img1).toHaveAttribute('loading', 'eager');
    expect(screen.getByAltText('Imagen 2')).toHaveAttribute('loading', 'lazy');
    // La 3 y la 4 todavía no se piden.
    expect(screen.queryByAltText('Imagen 3')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ir a la diapositiva 3' }));
    expect(screen.getByAltText('Imagen 3')).toBeInTheDocument();
    expect(screen.getByAltText('Imagen 4')).toBeInTheDocument();
  });

  it('muestra precio tachado y badge de descuento en diapositivas de producto', () => {
    renderSlider([slide(1, { badge: '-25%', badgeTone: 'green', price: { current: '$75.000', before: '$100.000' } })]);
    expect(screen.getByText('-25%')).toBeInTheDocument();
    expect(screen.getByText('$75.000')).toBeInTheDocument();
    expect(screen.getByText('$100.000')).toHaveClass('line-through');
  });
  describe('fondos y visual configurables', () => {
    let play: ReturnType<typeof vi.spyOn>;
    let pause: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
      pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    });
    afterEach(() => { play.mockRestore(); pause.mockRestore(); });

    const groups = () => Array.from(document.querySelectorAll('[aria-roledescription="slide"]')) as HTMLElement[];

    it('fondo de video: silencioso, en bucle, en línea, y se pausa con el botón de pausa', () => {
      renderSlider([
        slide(1, { imageUrl: undefined, noMedia: true, background: 'video', backgroundVideo: { url: 'https://cdn.test/v.mp4', poster: 'https://img.test/p.jpg', muted: true, loop: true } }),
        slide(2),
      ]);
      const video = groups()[0].querySelector('video')!;
      expect(video).toHaveAttribute('src', 'https://cdn.test/v.mp4');
      expect(video).toHaveAttribute('poster', 'https://img.test/p.jpg');
      expect(video.muted).toBe(true);
      expect(video.loop).toBe(true);
      expect(video).toHaveAttribute('playsinline');
      expect(play).toHaveBeenCalled();
      // texto en blanco sobre el video
      expect(screen.getByRole('heading', { name: 'Título 1' })).toHaveClass('text-white');
      fireEvent.click(screen.getByRole('button', { name: 'Pausar el avance automático' }));
      expect(pause).toHaveBeenCalled();
    });

    it('video de YouTube como visual de la derecha: iframe embebido sin controles', () => {
      renderSlider([slide(1, { imageUrl: undefined, media: { type: 'video', video: { url: 'https://youtu.be/abc123', muted: true, loop: true } } })]);
      const iframe = document.querySelector('iframe')!;
      expect(iframe.getAttribute('src')).toContain('youtube.com/embed/abc123');
      expect(iframe.getAttribute('src')).toContain('mute=1');
    });

    it('carrusel como visual: cambia de imagen con su intervalo solo en la diapositiva visible', () => {
      const images = ['https://img.test/a.jpg', 'https://img.test/b.jpg'];
      renderSlider([
        slide(1, { imageUrl: undefined, media: { type: 'carousel', carousel: { images, intervalMs: 2000, transition: 'fade' } } }),
        slide(2),
      ], 30000);
      const layers = () => Array.from(groups()[0].querySelectorAll('[style*="background-image"]')) as HTMLElement[];
      expect(layers()).toHaveLength(2);
      expect(layers()[0]).toHaveClass('opacity-100');
      act(() => { vi.advanceTimersByTime(2000); });
      expect(layers()[1]).toHaveClass('opacity-100');
      expect(layers()[0]).toHaveClass('opacity-0');
    });

    it('carrusel de fondo con transición de desplazamiento', () => {
      renderSlider([slide(1, { background: 'carousel', backgroundCarousel: { images: ['https://img.test/a.jpg', 'https://img.test/b.jpg'], intervalMs: 3000, transition: 'slide' } })]);
      const track = groups()[0].querySelector('[style*="translateX"]') as HTMLElement;
      expect(track.style.transform).toBe('translateX(-0%)');
      act(() => { vi.advanceTimersByTime(3000); });
      expect(track.style.transform).toBe('translateX(-50%)');
    });

    it('gradiente con colores propios y oscurecido', () => {
      renderSlider([slide(1, { background: 'gradient', gradient: 'linear-gradient(to bottom right, #111111, #222222, #333333)', overlayOpacity: 40 })]);
      const g = groups()[0];
      expect(g.style.background).toContain('linear-gradient');
      expect(g.querySelector('.bg-black')).toHaveStyle({ opacity: '0.4' });
      expect(screen.getByRole('heading', { name: 'Título 1' })).toHaveClass('text-white');
    });

    it('sin visual ("Ninguno") el texto ocupa todo el ancho', () => {
      renderSlider([slide(1, { noMedia: true })]);
      expect(screen.queryByAltText('Imagen 1')).toBeNull();
    });

    it('con prefers-reduced-motion el video no se reproduce y el carrusel no avanza', () => {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener: () => {}, removeEventListener: () => {} }));
      try {
        renderSlider([slide(1, {
          background: 'video', backgroundVideo: { url: 'https://cdn.test/v.mp4', muted: true, loop: true },
          imageUrl: undefined, media: { type: 'carousel', carousel: { images: ['https://img.test/a.jpg', 'https://img.test/b.jpg'], intervalMs: 2000, transition: 'fade' } },
        })]);
        expect(groups()[0].querySelector('video')).not.toHaveAttribute('autoplay');
        expect(play).not.toHaveBeenCalled();
        act(() => { vi.advanceTimersByTime(10000); });
        const layers = Array.from(groups()[0].querySelectorAll('[style*="background-image"]'));
        expect(layers[0]).toHaveClass('opacity-100');
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});
