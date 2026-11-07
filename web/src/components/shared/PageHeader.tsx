import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Home } from 'lucide-react';
import { STORE_CONTAINER } from './StoreContainer';

/**
 * Encabezado de página de la tienda: migas de pan (Inicio › sección anterior › página),
 * título, subtítulo y acciones a la derecha. Fondo blanco con línea inferior y el mismo
 * ancho y márgenes que el encabezado de la tienda (STORE_CONTAINER).
 * Sin gradiente: el gradiente de marca se reserva para el hero y los CTA grandes.
 *
 * - `backTo` + `backLabel`: la sección anterior como miga con enlace (p. ej. Carrito).
 *   Si es el inicio ("/"), no se repite: ya está la miga "Inicio".
 * - `onBack` + `backLabel`: una acción (p. ej. "Seguir comprando"): va como botón a la
 *   derecha, no en las migas (no es una página).
 * - `variant="crumbs"`: solo la franja de migas, para páginas que ponen su propio título
 *   (detalle de producto: el nombre va junto al precio).
 */
export function PageHeader({
  title,
  subtitle,
  backTo,
  backLabel = 'Volver',
  onBack,
  right,
  variant = 'default',
}: {
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  onBack?: () => void;
  right?: ReactNode;
  variant?: 'default' | 'crumbs';
}) {
  const crumbLink = 'inline-flex items-center gap-1 hover:text-app-700 transition-colors flex-shrink-0';
  const showParent = Boolean(backTo && backTo !== '/');
  const compact = variant === 'crumbs';

  const crumbs = (
    <nav aria-label="Ruta" className={`flex items-center gap-1.5 text-xs text-gray-500 min-w-0 ${compact ? '' : 'mb-1.5'}`}>
      <Link to="/" className={crumbLink}>
        <Home className="w-3.5 h-3.5" />
        Inicio
      </Link>
      {showParent && (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
          <Link to={backTo!} className={`${crumbLink} truncate max-w-[40%]`}>{backLabel}</Link>
        </>
      )}
      <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
      <span className="text-gray-700 font-medium truncate" aria-current="page">{title}</span>
    </nav>
  );

  if (compact) {
    return (
      <div className="bg-white border-b border-gray-200">
        <div className={`${STORE_CONTAINER} py-3`}>{crumbs}</div>
      </div>
    );
  }

  return (
    <div className="bg-white border-b border-gray-200">
      <div className={`${STORE_CONTAINER} py-4 md:py-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3`}>
        <div className="min-w-0">
          {crumbs}
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
        {(right || onBack) && (
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {backLabel}
              </button>
            )}
            {right}
          </div>
        )}
      </div>
    </div>
  );
}
