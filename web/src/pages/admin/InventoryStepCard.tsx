import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

/**
 * Paso numerado de un flujo de creación (conteos, conversiones, devoluciones).
 * Tarjeta limpia con el número del paso, título, ayuda corta y el contenido.
 * `done` marca el paso como completo; `disabled` lo atenúa hasta que se cumpla el anterior.
 */
export function StepCard({ step, title, description, done = false, disabled = false, actions, children }: {
  step: number;
  title: ReactNode;
  description?: ReactNode;
  done?: boolean;
  disabled?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={`bg-white rounded-xl border border-gray-200 p-4 md:p-5 transition-opacity ${disabled ? 'opacity-60' : ''}`} aria-disabled={disabled || undefined}>
      <div className="flex items-start gap-3">
        <span
          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            done ? 'bg-app-600 text-white' : disabled ? 'bg-gray-100 text-gray-400' : 'bg-app-100 text-app-700'
          }`}
        >
          {done ? <Check className="w-4 h-4" /> : step}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {actions}
          </div>
          {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {children && !disabled && <div className="mt-4 md:pl-10">{children}</div>}
    </section>
  );
}
