import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { getYouTubeId } from './heroModel';

/**
 * Piezas de fondo y visual del hero, compartidas por las cartas (HeroCard) y las diapositivas
 * del slider (HeroSlider): video (archivo o YouTube) y carrusel de imágenes.
 */

/**
 * Video a todo el tamaño del contenedor (object-cover). Se reproduce en silencio y en bucle
 * mientras `playing`; con movimiento reducido o en pausa queda quieto (se ve el póster).
 */
export function HeroVideo({ url, poster, muted = true, loop = true, playing = true, className = '' }: {
  url: string; poster?: string; muted?: boolean; loop?: boolean; playing?: boolean; className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const youtubeId = getYouTubeId(url);
  const play = playing && !reducedMotion;

  useEffect(() => {
    const v = ref.current;
    if (!v || youtubeId) return;
    if (play) v.play?.()?.catch(() => { /* el navegador puede bloquear el autoplay */ });
    else v.pause?.();
  }, [play, youtubeId]);

  if (youtubeId) {
    // YouTube no se puede pausar desde fuera sin su API: con movimiento reducido o en pausa se muestra el póster.
    if (!play) {
      const still = poster || `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
      return <div className={`absolute inset-0 bg-cover bg-center ${className}`} style={{ backgroundImage: `url("${still}")` }} />;
    }
    return (
      <div className={`absolute inset-0 overflow-hidden ${className}`}>
        <iframe
          className="absolute top-1/2 left-1/2 w-[300%] h-[300%] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1`}
          allow="autoplay; encrypted-media"
          title="Video"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <video
      ref={ref}
      className={`absolute inset-0 w-full h-full object-cover ${className}`}
      src={url}
      poster={poster}
      muted={muted}
      loop={loop}
      playsInline
      autoPlay={play}
      preload={play ? 'auto' : 'metadata'}
      aria-hidden="true"
    />
  );
}

/**
 * Carrusel de imágenes a todo el tamaño del contenedor, con transición de fundido o
 * desplazamiento. Solo avanza mientras `playing` y sin movimiento reducido.
 */
export function HeroCarousel({ images, intervalMs = 5000, transition = 'fade', playing = true, fit = 'cover', className = '' }: {
  images: string[]; intervalMs?: number; transition?: 'fade' | 'slide'; playing?: boolean; fit?: 'cover' | 'contain'; className?: string;
}) {
  const [index, setIndex] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const run = playing && !reducedMotion && images.length > 1;

  useEffect(() => {
    if (!run) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % images.length), Math.max(1000, intervalMs));
    return () => clearInterval(t);
  }, [run, images.length, intervalMs]);

  if (images.length === 0) return null;
  const current = index % images.length;
  const bg = (src: string) => ({ backgroundImage: `url("${src}")`, backgroundSize: fit, backgroundRepeat: 'no-repeat', backgroundPosition: 'center' });

  if (transition === 'slide') {
    return (
      <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
        <div
          className={`flex h-full ${reducedMotion ? '' : 'transition-transform duration-700 ease-out'}`}
          style={{ width: `${images.length * 100}%`, transform: `translateX(-${(current * 100) / images.length}%)` }}
        >
          {images.map((src, i) => (
            <div key={`${i}-${src.slice(-24)}`} className="h-full" style={{ width: `${100 / images.length}%`, ...bg(src) }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {images.map((src, i) => (
        <div
          key={`${i}-${src.slice(-24)}`}
          className={`absolute inset-0 ${reducedMotion ? '' : 'transition-opacity duration-1000'} ${i === current ? 'opacity-100' : 'opacity-0'}`}
          style={bg(src)}
        />
      ))}
    </div>
  );
}
