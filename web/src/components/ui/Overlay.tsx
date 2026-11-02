import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MoreVertical, X } from 'lucide-react';

/** Bloquea el scroll del body mientras `active`. */
function useBodyLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [active]);
}

/** Cierra con Escape. */
function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [active, onClose]);
}

const MODAL_SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const;

/**
 * Ventana modal estándar: título, contenido con scroll y pie fijo con los botones.
 * Para formularios cortos (≤ 6 campos), detalles rápidos y confirmaciones con datos.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; size?: keyof typeof MODAL_SIZES;
}) {
  useBodyLock(open);
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative flex max-h-[92vh] w-full flex-col bg-white shadow-xl rounded-t-2xl sm:rounded-xl ${MODAL_SIZES[size]} animate-fade-in`}>
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
          </div>
          <button type="button" onClick={onClose} title="Cerrar" className="p-1.5 -mr-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Panel lateral (derecha). Para ver o editar un registro sin salir del listado
 * (detalle rápido, filtros avanzados, formulario mediano).
 */
export function Drawer({ open, onClose, title, description, children, footer, width = 'md' }: {
  open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; width?: 'sm' | 'md' | 'lg';
}) {
  useBodyLock(open);
  useEscape(open, onClose);
  if (!open) return null;
  const w = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }[width];
  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <aside className={`fixed inset-y-0 right-0 flex w-full ${w} flex-col bg-white shadow-xl animate-slide-in-right`}>
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
          </div>
          <button type="button" onClick={onClose} title="Cerrar" className="p-1.5 -mr-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">{footer}</div>}
      </aside>
    </div>
  );
}

export interface MenuItem { label: ReactNode; icon?: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean; hidden?: boolean }

/** Menú de acciones (⋮) para filas de tabla o encabezados con muchas acciones. */
export function ActionMenu({ items, label = 'Acciones', trigger }: { items: MenuItem[]; label?: string; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEscape(open, () => setOpen(false));
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const visible = items.filter((i) => !i.hidden);
  if (!visible.length) return null;
  return (
    <div ref={ref} className="relative inline-block text-left">
      {trigger
        ? <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
        : <button type="button" title={label} aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100"><MoreVertical className="w-4 h-4" /></button>}
      {open && (
        <div className="absolute right-0 z-50 mt-1 min-w-[11rem] rounded-lg border border-gray-200 bg-white py-1 shadow-xl" role="menu">
          {visible.map((it, i) => (
            <button key={i} type="button" role="menuitem" disabled={it.disabled} onClick={() => { setOpen(false); it.onClick(); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-left disabled:opacity-40 ${it.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}>
              {it.icon}{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
