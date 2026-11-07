import type { ReactNode } from 'react';

/**
 * Ancho y márgenes de la tienda: los mismos del encabezado (logo y banda de categorías),
 * para que el contenido, el título de página y el pie queden alineados.
 */
export const STORE_CONTAINER = 'max-w-7xl mx-auto px-3 md:px-6';

/** Contenedor de una página de la tienda (con el espaciado vertical estándar). */
export function StoreContainer({ children, className = 'py-6 lg:py-8' }: { children: ReactNode; className?: string }) {
  return <div className={`${STORE_CONTAINER} ${className}`}>{children}</div>;
}
