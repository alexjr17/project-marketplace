import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Botón "Volver" sutil para los banners con gradiente (texto blanco).
 * Pasa `to` para ir a una ruta concreta; por defecto vuelve atrás.
 */
export function BackButton({
  label = 'Volver',
  to,
  onClick,
  variant = 'onGradient',
}: {
  label?: string;
  to?: string;
  onClick?: () => void;
  /** onGradient: pill blanco sobre gradiente. plain: enlace gris sutil. */
  variant?: 'onGradient' | 'plain';
}) {
  const navigate = useNavigate();
  const cls =
    variant === 'plain'
      ? 'inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors'
      : 'inline-flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-full pl-2.5 pr-3.5 py-1.5 transition-colors';
  return (
    <button type="button" onClick={() => (onClick ? onClick() : to ? navigate(to) : navigate(-1))} className={cls}>
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  );
}
