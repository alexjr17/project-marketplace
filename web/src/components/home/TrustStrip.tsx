import type { FeatureCard } from '../../types/settings';
import { featureIcon } from './featureIcons';

const LG_COLS: Record<number, string> = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' };

/** Franja compacta de beneficios (las "características" de Ajustes, máximo 4). */
export function TrustStrip({ features }: { features: FeatureCard[] }) {
  const items = features.slice(0, 4);
  if (items.length === 0) return null;
  const n = items.length;

  return (
    <section aria-label="Beneficios" className="pb-2">
      <div className="max-w-7xl mx-auto px-3 md:px-6">
        {/* gap-px sobre fondo gris = separadores finos entre celdas, sin bordes dobles */}
        <ul className={`grid grid-cols-2 ${LG_COLS[n]} gap-px bg-gray-200 rounded-xl border border-gray-200 overflow-hidden`}>
          {items.map((f, i) => {
            const Icon = featureIcon(f.icon);
            const lastOdd = i === n - 1 && n % 2 === 1;
            return (
              <li key={f.id} className={`bg-white flex items-center gap-3 p-3 md:px-4 min-w-0 ${lastOdd ? 'col-span-2 lg:col-span-1' : ''}`}>
                <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-app-50 text-app-600">
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-gray-900 text-sm leading-tight line-clamp-2 sm:truncate">{f.title}</span>
                  {f.description && <span className="hidden sm:block text-xs text-gray-500 truncate mt-0.5">{f.description}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
