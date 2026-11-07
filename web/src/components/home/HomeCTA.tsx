import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { CTASettings } from '../../types/settings';

/**
 * Llamado a la acción final (Ajustes > Página de inicio > Llamado a la acción). Usa el
 * gradiente de marca en línea (desde useSettings), como pide el estándar para los CTA grandes.
 */
export function HomeCTA({ cta, gradient, enableCustomizer }: { cta: CTASettings; gradient: string; enableCustomizer: boolean }) {
  if (!cta.isActive) return null;

  // Si el personalizador está apagado, un botón a /customize no lleva a nada: va al catálogo.
  const link = !enableCustomizer && cta.buttonLink?.startsWith('/customiz') ? '/catalog' : cta.buttonLink || '/catalog';
  const showButton = (cta.showButton ?? true) && !!cta.buttonText;

  return (
    <section className="py-5 md:py-7 pb-10">
      <div className="max-w-7xl mx-auto px-3 md:px-6">
        <div className="relative overflow-hidden rounded-xl px-5 py-8 md:p-12 text-center text-white" style={{ background: gradient }}>
          {/* Capa oscura: el texto blanco se lee aunque el gradiente termine en un color claro. */}
          <div aria-hidden className="absolute inset-0 bg-black/25" />
          <div className="relative">
            {(cta.showBadge ?? true) && cta.badge && (
              <span className="inline-flex items-center bg-white/20 text-white text-xs font-semibold uppercase tracking-[0.12em] px-3 py-1 rounded-full mb-3">
                {cta.badge}
              </span>
            )}
            {cta.title && <h2 className="text-2xl md:text-4xl font-display font-black mb-3 text-balance">{cta.title}</h2>}
            {cta.subtitle && <p className="text-sm md:text-lg text-white mb-6 max-w-xl mx-auto">{cta.subtitle}</p>}
            {showButton && (
              <Link
                to={link}
                className="inline-flex items-center justify-center gap-2 h-12 px-6 w-full sm:w-auto rounded-lg bg-white text-app-700 text-base font-semibold hover:bg-gray-50 transition-colors shadow-sm"
              >
                {cta.buttonText}
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
