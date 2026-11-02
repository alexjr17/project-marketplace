import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Inbox } from 'lucide-react';

/** Contenedor de cada pantalla del panel: mismo padding y separación en todas. */
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-4 md:p-6 space-y-5 ${className}`}>{children}</div>;
}

/** Encabezado estándar: icono en el color de la app, título, subtítulo, volver y acciones. */
export function PageHeader({ title, subtitle, icon: Icon, backTo, actions }: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  /** Ruta para el botón Volver (flecha a la izquierda del título). */
  backTo?: string;
  /** Botones a la derecha (el principal al final). */
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {backTo && (
          <Link to={backTo} title="Volver" aria-label="Volver" className="p-2 -ml-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        )}
        {Icon && (
          <div className="p-2 bg-app-100 rounded-lg flex-shrink-0"><Icon className="w-6 h-6 text-app-600" /></div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Tarjeta base: fondo blanco, borde gris, esquinas xl. */
export function Card({ children, className = '', padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div className={`bg-white rounded-xl border border-gray-200 ${padded ? 'p-4 md:p-5' : 'overflow-hidden'} ${className}`}>{children}</div>;
}

/** Título de bloque dentro de una tarjeta. */
export function CardTitle({ children, icon: Icon, actions }: { children: ReactNode; icon?: LucideIcon; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-4">
      <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
        {Icon && <Icon className="w-5 h-5 text-app-600" />}{children}
      </h2>
      {actions}
    </div>
  );
}

export type Tone = 'app' | 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'purple';
const TONE_SOFT: Record<Tone, string> = {
  app: 'bg-app-100 text-app-700',
  gray: 'bg-gray-100 text-gray-600',
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
};

const TONE_TEXT: Record<Tone, string> = {
  app: 'text-app-700', gray: 'text-gray-500', green: 'text-green-700', yellow: 'text-amber-700',
  red: 'text-red-600', blue: 'text-blue-700', purple: 'text-purple-700',
};

/**
 * Indicador compacto: etiqueta + icono pequeño arriba, valor abajo y una nota opcional
 * (p. ej. "2 con stock bajo" con hintTone="yellow"). El valor llega ya formateado
 * (dinero con separador de miles y sin decimales sobrantes). Con `to` toda la tarjeta es un enlace.
 * Se usan en filas `grid grid-cols-2 lg:grid-cols-4 gap-3`.
 */
export function StatCard({ label, value, icon: Icon, tone = 'app', hint, hintTone = 'gray', to }: {
  label: ReactNode; value: ReactNode; icon?: LucideIcon; tone?: Tone; hint?: ReactNode; hintTone?: Tone; to?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-gray-500 truncate">{label}</p>
        {Icon && <span className={`rounded-md p-1.5 flex-shrink-0 ${TONE_SOFT[tone]}`}><Icon className="w-3.5 h-3.5" /></span>}
      </div>
      <p className="mt-1 text-xl font-semibold text-gray-900 tabular-nums leading-tight truncate">{value}</p>
      {hint && <p className={`mt-0.5 text-xs truncate ${TONE_TEXT[hintTone]}`}>{hint}</p>}
    </>
  );
  const cls = 'block bg-white rounded-xl border border-gray-200 px-4 py-3';
  return to
    ? <Link to={to} className={`${cls} transition-colors hover:border-app-300 hover:bg-app-50/40`}>{body}</Link>
    : <div className={cls}>{body}</div>;
}

/** Estado / etiqueta. Activo = green, inactivo = gray, pendiente = yellow, error = red. */
export function Badge({ children, tone = 'gray', className = '' }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${TONE_SOFT[tone]} ${className}`}>{children}</span>;
}

/** Lista vacía o sin resultados. */
export function EmptyState({ title, description, icon: Icon = Inbox, action }: { title: ReactNode; description?: ReactNode; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <div className="py-12 px-4 text-center">
      <Icon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="font-medium text-gray-700">{title}</p>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Carga de una pantalla o bloque. */
export function Spinner({ className = '', label }: { className?: string; label?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-12 text-gray-400 ${className}`}>
      <span className="w-8 h-8 border-[3px] border-app-200 border-t-app-600 rounded-full animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
