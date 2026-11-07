import { Link } from 'react-router-dom';
import { ArrowRight, Upload } from 'lucide-react';
import { silhouetteDataUrl } from '../customizer/garment';

/**
 * Tarjeta "Diseña la tuya" dentro de la grilla del catálogo. Las prendas personalizables son
 * plantillas aparte (no salen en el catálogo), así que esta tarjeta lleva al estudio desde
 * donde se decide la compra. Mismo tamaño y estructura que ProductCard.
 */
export function DesignYourOwnCard() {
  return (
    <Link
      to="/customize"
      className="group bg-white rounded-xl border border-app-200 hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500"
    >
      <div className="relative aspect-square bg-app-50 overflow-hidden flex items-center justify-center">
        <img src={silhouetteDataUrl('front', '#FFFFFF')} alt="" aria-hidden="true" className="w-[78%] h-[78%] object-contain" />
        <span className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 w-[26%] aspect-square rounded-md border-2 border-dashed border-app-400 flex items-center justify-center text-app-600">
          <Upload className="w-1/2 h-1/2" strokeWidth={1.75} aria-hidden="true" />
        </span>
      </div>
      <div className="p-3 sm:p-4 flex flex-col gap-1.5 flex-1 min-w-0">
        <span className="text-[11px] font-semibold tracking-wide text-app-700 uppercase">Estudio de diseño</span>
        <h3 className="font-semibold text-gray-900 text-sm leading-snug">Diseña la tuya</h3>
        <p className="text-xs text-gray-600 line-clamp-2">Sube tu imagen, elige la prenda y mírala antes de comprar.</p>
        <span className="mt-auto pt-1 inline-flex items-center gap-1 text-sm font-semibold text-app-700">
          Empezar
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
