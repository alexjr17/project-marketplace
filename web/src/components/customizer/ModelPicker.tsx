import { useState } from 'react';
import { ArrowRight, Palette, Sparkles } from 'lucide-react';
import { EmptyState, Skeleton } from '../ui';
import { useCurrency } from '../../hooks/useCurrency';
import { assetUrl } from '../../utils/assetUrl';
import type { Template } from '../../services/templates.service';
import { templateCover } from './customizerModel';
import { silhouetteDataUrl } from './garment';

/** Foto del modelo o, si no hay o falla, la silueta integrada. */
export function GarmentThumb({ src, alt, className = '' }: { src?: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const url = src && !failed ? assetUrl(src) : silhouetteDataUrl('front', '#F3F4F6');
  return <img src={url} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`w-full h-full ${src && !failed ? 'object-cover' : 'object-contain p-6'} ${className}`} />;
}

/** Paso 0: elegir el modelo a personalizar. */
export function ModelPicker({ templates, loading, onPick }: { templates: Template[]; loading: boolean; onPick: (t: Template) => void }) {
  const { format } = useCurrency();

  return (
    <div className="max-w-7xl mx-auto px-3 md:px-6 py-6 md:py-10">
      <div className="max-w-2xl mb-6 md:mb-8">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-app-700 bg-app-50 rounded-full px-2.5 py-1 mb-3">
          <Sparkles className="w-3.5 h-3.5" /> Diseña en 3 pasos
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">¿Qué prenda quieres personalizar?</h2>
        <p className="text-gray-600 mt-2 text-sm md:text-base">Elige el modelo, sube tu imagen y mira cómo queda antes de comprar. Pagas solo las zonas que diseñes.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {[0, 1].map((i) => <div key={i} className="rounded-2xl border border-gray-200 bg-white overflow-hidden"><Skeleton className="aspect-[4/3] w-full rounded-none" /><div className="p-5 space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-1/3" /></div></div>)}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState icon={Palette} title="Aún no hay modelos para personalizar" description="Vuelve pronto: estamos preparando nuevas prendas." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t)}
              className="group text-left rounded-2xl border border-gray-200 bg-white overflow-hidden hover:shadow-md hover:border-app-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500 transition"
            >
              <div className="aspect-[4/3] bg-gradient-to-b from-gray-50 to-gray-100">
                <GarmentThumb src={templateCover(t)} alt={t.name} />
              </div>
              <div className="p-4 md:p-5">
                {t.typeName && <p className="text-xs font-medium text-gray-500 mb-0.5">{t.typeName}</p>}
                <h3 className="text-base md:text-lg font-semibold text-gray-900">{t.name.replace(/\s+personalizable$/i, '')}</h3>
                <div className="flex items-end justify-between gap-3 mt-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Desde</p>
                    <p className="text-lg font-bold text-gray-900 tabular-nums">{format(t.basePrice)}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-app-700 group-hover:gap-2.5 transition-all">
                    Diseñar <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
                {t.colors?.length > 0 && (
                  <div className="flex items-center gap-1 mt-3" aria-label="Colores disponibles">
                    {t.colors.slice(0, 6).map((c) => <span key={c.id} title={c.name} className="w-4 h-4 rounded-full ring-1 ring-black/10" style={{ backgroundColor: c.hexCode }} />)}
                    {t.colors.length > 6 && <span className="text-xs text-gray-500 ml-1">+{t.colors.length - 6}</span>}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 md:mt-10">
        {['Elige modelo, color y talla', 'Sube tu imagen y ubícala', 'Revisa el precio y agrégalo al carrito'].map((s, i) => (
          <li key={s} className="flex items-center gap-3 rounded-xl bg-white border border-gray-200 px-4 py-3">
            <span className="w-7 h-7 rounded-full bg-app-50 text-app-700 text-sm font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
            <span className="text-sm text-gray-700">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
