import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { AnnouncementsRenderer } from '../announcements/AnnouncementsRenderer';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  // El header es fijo y su alto varía (breakpoint/contenido). Medimos el alto
  // real para que el contenido (y la barra de anuncios) quede pegado, sin hueco.
  const [headerH, setHeaderH] = useState<number>(72);

  useEffect(() => {
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
    <div className="min-h-screen flex flex-col bg-gray-50 overflow-x-clip" style={{ '--store-header-h': `${headerH}px` } as CSSProperties}>
      <Header />
      <main className="flex-1 overflow-x-clip pb-20 md:pb-0" style={{ paddingTop: headerH }}>
        <AnnouncementsRenderer />
        {children}
      </main>
      <Footer />
    </div>
  );
};
