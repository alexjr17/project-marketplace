import { Truck } from 'lucide-react';
import { useCurrency } from '../../hooks/useCurrency';
import { freeShippingProgress } from './freeShipping';

/** Barra "Te faltan $X para el envío gratis" (o "¡Tienes envío gratis!"). */
export function FreeShippingBar({ subtotal, threshold, city }: { subtotal: number; threshold: number | null | undefined; city?: string }) {
  const { format } = useCurrency();
  const progress = freeShippingProgress(subtotal, threshold);
  if (!progress || subtotal <= 0) return null;

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${progress.reached ? 'bg-green-50 border-green-200' : 'bg-app-50 border-app-100'}`}>
      <p className={`flex items-center gap-2 text-sm ${progress.reached ? 'text-green-800' : 'text-gray-700'}`}>
        <Truck className={`w-4 h-4 flex-shrink-0 ${progress.reached ? 'text-green-600' : 'text-app-600'}`} />
        {progress.reached ? (
          <span><strong>¡Tienes envío gratis!</strong>{city ? ` a ${city}` : ''}</span>
        ) : (
          <span>Te faltan <strong className="text-gray-900">{format(progress.remaining)}</strong> para el envío gratis{city ? ` a ${city}` : ''}</span>
        )}
      </p>
      <div
        className="mt-2 h-1.5 rounded-full bg-white overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.pct}
        aria-label="Progreso hacia el envío gratis"
      >
        <div className={`h-full rounded-full transition-[width] duration-500 ${progress.reached ? 'bg-green-500' : 'bg-app-600'}`} style={{ width: `${progress.pct}%` }} />
      </div>
    </div>
  );
}
