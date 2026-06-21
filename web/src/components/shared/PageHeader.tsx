import type { ReactNode } from 'react';
import { BackButton } from './BackButton';
import { useSettings } from '../../context/SettingsContext';

/**
 * Cabecera estándar y compacta para vistas de la tienda: botón "Volver"
 * estándar + título (y subtítulo). Usa el gradiente de marca configurado
 * (reactivo), pero ocupa poco espacio. Reemplaza los banners grandes.
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
  const { settings } = useSettings();
  const brand = settings.appearance?.brandColors ||
    settings.general?.brandColors || { primary: '#7c3aed', secondary: '#ec4899', accent: '#f59e0b' };
  const gradient = `linear-gradient(to right, ${brand.primary}, ${brand.secondary}, ${brand.accent})`;

  return (
    <div className="text-white shadow-md" style={{ background: gradient }}>
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <BackButton variant="onGradient" label={backLabel} to={backTo} onClick={onBack} />
        <div className="h-6 w-px bg-white/30" />
        <div className="min-w-0 flex-1">
          <h1 className="text-base md:text-lg font-bold leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-white/80 truncate">{subtitle}</p>}
        </div>
        {right}
      </div>
    </div>
  );
}
