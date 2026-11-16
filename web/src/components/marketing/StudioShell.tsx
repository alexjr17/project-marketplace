/**
 * Armazón del estudio de diseño (posts y videos), a pantalla completa como un editor:
 * - arriba, la barra: el estudio (Post / Video), las herramientas y las acciones (descargar, guardar, publicar);
 * - a la izquierda, un riel de íconos que abre su panel (Producto, Plantillas, Fondo, Archivos…);
 * - al centro, el lienzo, que se ajusta solo al espacio libre;
 * - a la derecha, las propiedades de lo elegido;
 * - abajo (en video), el reproductor y la línea de tiempo.
 * En pantallas chicas todo se apila.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';

export interface RailItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Marca de "falta esto" (por ejemplo, aún no se eligió qué mostrar). */
  dot?: boolean;
}

export function StudioShell({ label, toolbar, actions, rail, active, onActive, panelTitle, panel, stage, inspectorTitle, inspector, bottom }: {
  /** Nombre del editor para lectores de pantalla ("Diseñador de piezas", "Editor de video"). */
  label: string;
  toolbar: ReactNode;
  actions: ReactNode;
  rail: RailItem[];
  active: string | null;
  onActive: (id: string | null) => void;
  panelTitle: string;
  panel: ReactNode;
  /** El lienzo (o el monitor del video), con lo que va encima. */
  stage: ReactNode;
  inspectorTitle: ReactNode;
  inspector: ReactNode;
  bottom?: ReactNode;
}) {
  return (
    <section aria-label={label} className="flex flex-col bg-gray-100 lg:h-[calc(100dvh-4rem)] lg:overflow-hidden">
      {/* Barra superior */}
      <header className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-white border-b border-gray-200 lg:h-14 lg:py-0">
        {toolbar}
        <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Riel */}
        <nav aria-label="Herramientas" className="flex lg:flex-col gap-1 p-1.5 bg-white border-b lg:border-b-0 lg:border-r border-gray-200 overflow-x-auto lg:overflow-y-auto lg:w-[76px] flex-shrink-0">
          {rail.map((r) => {
            const Icon = r.icon;
            const on = active === r.id;
            return (
              <button
                key={r.id} type="button" aria-pressed={on} title={r.label} onClick={() => onActive(on ? null : r.id)}
                className={`relative flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 min-w-[64px] text-[11px] font-medium leading-tight transition-colors ${on ? 'bg-app-50 text-app-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-center">{r.label}</span>
                {r.dot && <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-app-600 ring-2 ring-white" aria-label="Pendiente" />}
              </button>
            );
          })}
        </nav>

        {/* Panel del riel */}
        {active && (
          <aside aria-label={panelTitle} className="flex flex-col bg-white border-b lg:border-b-0 lg:border-r border-gray-200 lg:w-[330px] flex-shrink-0 min-h-0">
            <div className="flex items-center justify-between gap-2 px-4 h-12 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-900">{panelTitle}</h2>
              <button type="button" title="Cerrar el panel" aria-label="Cerrar el panel" onClick={() => onActive(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 max-h-[70vh] lg:max-h-none">{panel}</div>
          </aside>
        )}

        {/* Lienzo y dock inferior */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="relative flex-1 min-h-[420px] lg:min-h-0 bg-[radial-gradient(circle,rgb(0_0_0/0.06)_1px,transparent_1px)] [background-size:18px_18px]">
            {stage}
          </div>
          {bottom && <div className="bg-white border-t border-gray-200 flex-shrink-0">{bottom}</div>}
        </div>

        {/* Propiedades */}
        <aside aria-label="Propiedades" className="flex flex-col bg-white border-t lg:border-t-0 lg:border-l border-gray-200 lg:w-[350px] flex-shrink-0 min-h-0">
          <div className="flex items-center px-4 h-12 border-b border-gray-100 flex-shrink-0 text-sm font-semibold text-gray-900 min-w-0">{inspectorTitle}</div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4">{inspector}</div>
        </aside>
      </div>
    </section>
  );
}

/** Lienzo que ocupa el mayor espacio posible sin deformarse (proporción ancho:alto). */
export function FitBox({ w, h, pad = 32, children }: { w: number; h: number; pad?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const aw = Math.max(80, el.clientWidth - pad * 2), ah = Math.max(80, el.clientHeight - pad * 2);
      const k = Math.min(aw / w, ah / h);
      setSize({ w: Math.floor(w * k), h: Math.floor(h * k) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h, pad]);
  return (
    <div ref={ref} className="absolute inset-0 grid place-items-center overflow-hidden">
      <div className="relative" style={{ width: size.w, height: size.h, lineHeight: 0 }}>{children}</div>
    </div>
  );
}

/** Interruptor Post / Video del estudio (va al inicio de la barra). */
export function StudioModeSwitch<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; icon: LucideIcon }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg bg-gray-100 p-0.5" role="radiogroup" aria-label="Estudio">
      {options.map((o) => {
        const Icon = o.icon;
        const on = value === o.value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium transition-colors ${on ? 'bg-white text-app-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            <Icon className="w-4 h-4" />{o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Separador vertical de la barra. */
export const ToolbarSep = () => <span className="hidden sm:block w-px h-6 bg-gray-200 mx-1" />;

/** Formato (proporción) de la pieza, en la barra. */
export function RatioSwitch<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex rounded-lg bg-gray-100 p-0.5" role="radiogroup" aria-label={label}>
      {options.map((r) => (
        <button key={r.value} type="button" role="radio" aria-checked={value === r.value} title={r.hint} onClick={() => onChange(r.value)}
          className={`px-2.5 h-8 rounded-md text-xs font-medium tabular-nums ${value === r.value ? 'bg-white text-app-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
          {r.label}
        </button>
      ))}
    </div>
  );
}
