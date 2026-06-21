import type { ReactNode } from 'react';
import { BackButton } from './BackButton';

/**
 * Cabecera estándar y compacta para vistas de la tienda: botón "Volver"
 * estándar + título (y subtítulo opcional). Reemplaza los banners grandes.
 */
export function PageHeader({
  title,
  subtitle,
  backTo,
  backLabel = 'Volver',
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <BackButton variant="plain" label={backLabel} to={backTo} onClick={onBack} />
        <div className="h-5 w-px bg-gray-200" />
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-gray-900 leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
        </div>
        {right}
      </div>
    </div>
  );
}
