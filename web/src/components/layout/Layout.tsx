import { useLayoutEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { AnnouncementsRenderer } from '../announcements/AnnouncementsRenderer';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  // El header es fijo y su alto varía (breakpoint/contenido). Medimos el alto
  // real para que el contenido (y la barra de anuncios) quede pegado, sin hueco.
  // Valor inicial = alto real por breakpoint (fila + banda de categorías), para no mover la
  // página al medir; useLayoutEffect corrige antes de pintar si el contenido cambia el alto.
  const [headerH, setHeaderH] = useState<number>(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches ? 116 : 100,
  );

  useLayoutEffect(() => {
    const el = document.querySelector('header');
    if (!el) return;
    const update = () => setHeaderH(Math.round(el.getBoundingClientRect().height));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    // overflow-x-clip (no hidden): recorta igual pero no crea un contenedor de scroll, así
    // funciona `sticky` en las páginas. --store-header-h = alto del encabezado fijo.
    // El padding inferior (alto de la barra inferior del celular) cubre también el pie de página.
    <div
      className="min-h-screen flex flex-col bg-gray-50 overflow-x-clip pb-[var(--store-bottom-nav)]"
      style={{ '--store-header-h': `${headerH}px` } as CSSProperties}
    >
      <Header />
      <main className="flex-1 overflow-x-clip" style={{ paddingTop: headerH }}>
        <AnnouncementsRenderer />
        {children}
      </main>
      <Footer />
    </div>
  );
};
