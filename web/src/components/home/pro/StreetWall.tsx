import { useLayoutEffect, useRef } from 'react';
import { PHOTOS } from './photos';
import { gsap } from './motion';

/**
 * Muro de fotos de gente con prendas estampadas. En escritorio las columnas se desplazan a
 * distinta velocidad con el scroll (paralaje suave); con menos movimiento quedan quietas.
 */
export function StreetWall({ reduced }: { reduced: boolean }) {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (reduced || !root.current) return;
    const mm = gsap.matchMedia();
    mm.add('(min-width: 768px)', () => {
      gsap.utils.toArray<HTMLElement>('[data-speed]', root.current).forEach((el) => {
        gsap.fromTo(el, { yPercent: Number(el.dataset.speed) }, {
          yPercent: -Number(el.dataset.speed),
          ease: 'none',
          scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });
    });
    return () => mm.revert();
  }, [reduced]);

  const img = (p: (typeof PHOTOS)[keyof typeof PHOTOS], cls: string) => (
    <img src={p.src} srcSet={p.srcSet} sizes="(min-width: 768px) 33vw, 50vw" alt={p.alt} loading="lazy" className={`w-full object-cover rounded-2xl ${cls}`} />
  );

  return (
    <section ref={root} className="bg-app-600 text-white pt-20 md:pt-28 pb-12 md:pb-16 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="md:flex md:items-end md:justify-between gap-10">
          <h2 className="font-poster font-bold tracking-[-0.035em] uppercase leading-[0.9] text-[clamp(2.2rem,5vw,4.2rem)]">
            Hecho para<br />usarse
          </h2>
          <p className="mt-4 md:mt-0 max-w-sm text-lg text-white/75">
            Para tu marca, tu equipo, un evento o solo para ti: tu diseño sale del taller listo para ponerse.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
          <div data-speed="6" className="space-y-3 md:space-y-5">
            {img(PHOTOS.mural, 'aspect-[4/5]')}
            {img(PHOTOS.tintas, 'aspect-[4/3]')}
          </div>
          <div data-speed="-8" className="space-y-3 md:space-y-5 md:pt-16">
            {img(PHOTOS.grafiti, 'aspect-[2/3]')}
            {img(PHOTOS.marco, 'aspect-[4/3] md:hidden')}
          </div>
          <div data-speed="10" className="hidden md:block space-y-5">
            {img(PHOTOS.espalda, 'aspect-[4/3]')}
            {img(PHOTOS.noche, 'aspect-[3/4]')}
          </div>
        </div>
      </div>
    </section>
  );
}
