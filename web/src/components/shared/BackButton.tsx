import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Botón "Volver" sutil para los banners con gradiente (texto blanco).
 * Pasa `to` para ir a una ruta concreta; por defecto vuelve atrás.
 */
export function BackButton({ label = 'Volver', to, onClick }: { label?: string; to?: string; onClick?: () => void }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => (onClick ? onClick() : to ? navigate(to) : navigate(-1))}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-full pl-2.5 pr-3.5 py-1.5 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  );
}
