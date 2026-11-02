import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, ChevronRight as Sep, Info, TriangleAlert } from 'lucide-react';

/** Mensaje dentro de la página (no flotante): avisos que el usuario debe leer antes de seguir. */
export function Alert({ tone = 'info', title, children, action }: { tone?: 'info' | 'success' | 'warning' | 'error'; title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  const t = {
    info: ['bg-blue-50 border-blue-200 text-blue-800', Info],
    success: ['bg-green-50 border-green-200 text-green-800', CheckCircle2],
    warning: ['bg-amber-50 border-amber-200 text-amber-900', TriangleAlert],
    error: ['bg-red-50 border-red-200 text-red-800', AlertCircle],
  } as const;
  const [cls, Icon] = t[tone];
  return (
    <div className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${cls}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-px" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

/** Pestañas. Para dividir una pantalla grande (detalle de pedido, atributos del catálogo). */
export function Tabs<T extends string>({ tabs, value, onChange }: {
  tabs: { value: T; label: ReactNode; count?: number; hidden?: boolean }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="border-b border-gray-200 overflow-x-auto">
      <nav className="-mb-px flex gap-1" role="tablist">
        {tabs.filter((t) => !t.hidden).map((t) => (
          <button key={t.value} type="button" role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${value === t.value ? 'border-app-600 text-app-700' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'}`}>
            {t.label}
            {t.count !== undefined && <span className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${value === t.value ? 'bg-app-100 text-app-700' : 'bg-gray-100 text-gray-600'}`}>{t.count}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

/** Migas de pan (las pone el layout; se pueden usar dentro de una página). */
export function Breadcrumbs({ items }: { items: { label: ReactNode; to?: string }[] }) {
  return (
    <nav aria-label="Ruta" className="flex items-center gap-1 text-sm text-gray-500 min-w-0">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1 min-w-0">
          {i > 0 && <Sep className="w-3.5 h-3.5 flex-shrink-0 text-gray-300" />}
          {it.to && i < items.length - 1
            ? <Link to={it.to} className="truncate hover:text-gray-900">{it.label}</Link>
            : <span className={`truncate ${i === items.length - 1 ? 'text-gray-900 font-medium' : ''}`}>{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

/** Datos de un registro en pares etiqueta / valor (pantallas de detalle). */
export function DescriptionList({ items, cols = 2 }: { items: { label: ReactNode; value: ReactNode; full?: boolean }[]; cols?: 1 | 2 | 3 }) {
  const c = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3' }[cols];
  return (
    <dl className={`grid grid-cols-1 ${c} gap-x-6 gap-y-4`}>
      {items.map((it, i) => (
        <div key={i} className={it.full ? 'sm:col-span-full' : ''}>
          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{it.label}</dt>
          <dd className="mt-1 text-sm text-gray-900 break-words">{it.value ?? <span className="text-gray-400">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Historial de eventos (estados de un pedido, movimientos). */
export function Timeline({ items }: { items: { title: ReactNode; meta?: ReactNode; description?: ReactNode; tone?: 'app' | 'gray' | 'green' | 'red' }[] }) {
  const dot = { app: 'bg-app-600', gray: 'bg-gray-300', green: 'bg-green-500', red: 'bg-red-500' };
  return (
    <ol className="relative space-y-4 border-l border-gray-200 ml-1.5">
      {items.map((it, i) => (
        <li key={i} className="pl-5">
          <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${dot[it.tone ?? 'app']}`} />
          <p className="text-sm font-medium text-gray-900">{it.title}</p>
          {it.meta && <p className="text-xs text-gray-500">{it.meta}</p>}
          {it.description && <p className="text-sm text-gray-600 mt-1">{it.description}</p>}
        </li>
      ))}
    </ol>
  );
}

/** Esqueleto de carga (bloques grises animados) para tarjetas y filas. */
export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200 ${className}`} />;
}

/** Paginación estándar (pie de TableCard). */
export function Pager({ page, pageSize, total, onPage, onPageSize, sizes = [10, 25, 50] }: {
  page: number; pageSize: number; total: number; onPage: (p: number) => void; onPageSize?: (s: number) => void; sizes?: number[];
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-600">
      <div className="flex items-center gap-2">
        <span>{from}–{to} de {total}</span>
        {onPageSize && (
          <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} aria-label="Filas por página" className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:border-app-500">
            {sizes.map((s) => <option key={s} value={s}>{s} / pág.</option>)}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button type="button" title="Anterior" disabled={page <= 1} onClick={() => onPage(page - 1)} className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
        <span className="px-2">Página <b className="text-gray-900">{page}</b> de {pages}</span>
        <button type="button" title="Siguiente" disabled={page >= pages} onClick={() => onPage(page + 1)} className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

/**
 * Bloque de configuración: título y descripción a la izquierda, controles a la derecha.
 * Estándar de todas las pantallas de Configuración.
 */
export function SettingsSection({ title, description, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8 py-6 first:pt-0 border-b border-gray-200 last:border-0">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>
      <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 md:p-5 space-y-4">{children}</div>
    </section>
  );
}
