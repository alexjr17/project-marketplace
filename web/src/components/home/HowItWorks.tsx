import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { buttonClass } from '../ui';
import { useCurrency } from '../../hooks/useCurrency';
import { useStoreData } from '../../hooks/useStoreData';
import { templatesService, type Template } from '../../services/templates.service';
import { isDark, silhouetteDataUrl } from '../customizer/garment';
import { HomeBlock } from './SectionHeader';

const STEPS = [
  { title: 'Elige la prenda', text: 'Modelo, color y talla.' },
  { title: 'Sube tu diseño', text: 'Imagen, logo o frase; lo ubicas tú.' },
  { title: 'Te la enviamos', text: 'La estampamos y llega a tu casa.' },
];

/** Colores de muestra si todavía no hay modelos cargados. */
const FALLBACK_COLORS = [
  { name: 'Blanco', hexCode: '#FFFFFF' },
  { name: 'Negro', hexCode: '#1F2937' },
  { name: 'Arena', hexCode: '#E7D9C3' },
  { name: 'Verde oliva', hexCode: '#6B7A4B' },
  { name: 'Azul marino', hexCode: '#1E3A5F' },
];

const fetchTemplates = () => templatesService.getPublicTemplates();

/** Diseño de muestra que se "estampa" en el pecho de la prenda. Toma el color de la app. */
function SampleDesign({ onDark }: { onDark: boolean }) {
  const ink = 'currentColor';
  return (
    <svg viewBox="0 0 120 120" className={`w-full h-full ${onDark ? 'text-white' : 'text-app-600'}`} aria-hidden="true">
      <circle cx="60" cy="52" r="30" fill="none" stroke={ink} strokeWidth="5" />
      <path d="M38 62 L52 44 L62 56 L70 48 L84 64 Z" fill={ink} />
      <circle cx="72" cy="40" r="5" fill={ink} />
      <text x="60" y="104" textAnchor="middle" fontFamily="inherit" fontWeight="800" fontSize="15" letterSpacing="2" fill={ink}>
        TU DISEÑO
      </text>
    </svg>
  );
}

/**
 * Franja del estudio de diseño en la portada (bloque "Personaliza en 3 pasos"): una prenda de
 * muestra que cambia de color al tocar las muestras, con el diseño estampado en su zona, los
 * 3 pasos y el botón al personalizador con el precio "Desde". Solo se ve si el personalizador
 * está activo.
 */
export function HowItWorks({ title, subtitle }: { title: string; subtitle?: string }) {
  const { format } = useCurrency();
  const templates = useStoreData<Template[]>('studio:templates', fetchTemplates);

  const { colors, fromPrice } = useMemo(() => {
    const list = (templates.data ?? []).filter((t) => t.isActive !== false);
    const seen = new Set<string>();
    const fromTemplates = list
      .flatMap((t) => t.colors ?? [])
      .filter((c) => c.hexCode && !seen.has(c.hexCode.toUpperCase()) && seen.add(c.hexCode.toUpperCase()));
    const prices = list.map((t) => Number(t.basePrice)).filter((p) => p > 0);
    return {
      colors: (fromTemplates.length >= 2 ? fromTemplates : FALLBACK_COLORS).slice(0, 6),
      fromPrice: prices.length ? Math.min(...prices) : null,
    };
  }, [templates.data]);

  const [picked, setPicked] = useState(0);
  const color = colors[Math.min(picked, colors.length - 1)];
  const dark = isDark(color.hexCode);

  return (
    <HomeBlock>
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden grid md:grid-cols-[1.05fr_1fr]">
        {/* Texto, pasos y botón */}
        <div className="p-5 md:p-10 flex flex-col justify-center order-last md:order-none">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-app-700">Estudio de diseño</p>
          <h2 className="mt-2 text-2xl md:text-4xl font-display font-black text-gray-900 tracking-tight text-balance">{title}</h2>
          {subtitle && <p className="mt-2 text-gray-600 md:text-lg max-w-md">{subtitle}</p>}

          <ol className="mt-6 grid gap-3 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3 sm:block md:flex lg:block">
                <span className="text-2xl font-black tabular-nums text-app-600 leading-none flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <span className="block min-w-0 sm:mt-2 md:mt-0 lg:mt-2">
                  <span className="block font-semibold text-gray-900 text-sm">{s.title}</span>
                  <span className="block text-sm text-gray-600">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-7 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
            <Link to="/customize" className={`${buttonClass('primary', 'lg')} gap-2 w-full sm:w-auto`}>
              Diseña la tuya
              <ArrowRight className="w-4 h-4" />
            </Link>
            {fromPrice !== null && (
              <p className="text-sm text-gray-600 text-center sm:text-left">
                Desde <span className="font-semibold text-gray-900 tabular-nums">{format(fromPrice)}</span> · pagas solo las zonas que diseñes
              </p>
            )}
          </div>
        </div>

        {/* Prenda de muestra */}
        <div className="relative bg-app-50 px-6 pt-6 pb-5 md:p-8 flex flex-col items-center justify-center">
          <div className="relative w-full max-w-[300px] md:max-w-[360px] aspect-square">
            <img
              src={silhouetteDataUrl('front', color.hexCode)}
              alt={`Prenda de muestra en color ${color.name.toLowerCase()} con un diseño estampado en el pecho`}
              className="w-full h-full object-contain drop-shadow-sm"
            />
            {/* Zona de estampado del pecho (proporcional a la silueta de 500×500) */}
            <div className="absolute left-[34%] top-[24%] w-[32%] h-[34%] rounded-md border-2 border-dashed border-app-400/70">
              <div className="absolute inset-[10%]">
                <SampleDesign onDark={dark} />
              </div>
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-app-700 ring-1 ring-app-200">
                Zona de estampado
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2" role="group" aria-label="Probar un color de prenda">
            {colors.map((c, i) => (
              <button
                key={c.hexCode}
                type="button"
                onClick={() => setPicked(i)}
                aria-pressed={i === picked}
                aria-label={c.name}
                title={c.name}
                className={`w-9 h-9 rounded-full ring-1 ring-black/15 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500 ${i === picked ? 'ring-2 ring-app-600 ring-offset-2 ring-offset-app-50' : ''}`}
                style={{ backgroundColor: c.hexCode }}
              />
            ))}
          </div>
        </div>
      </div>
    </HomeBlock>
  );
}
