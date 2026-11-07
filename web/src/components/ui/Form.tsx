import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

/** Clase base de input/select/textarea. Foco en el color de la app. */
export const fieldClass = (error?: boolean) =>
  `w-full h-10 rounded-lg border bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed ${
    error ? 'border-red-400 focus:ring-red-200 focus:border-red-500' : 'border-gray-300 focus:ring-app-200 focus:border-app-500'
  }`;

/**
 * Etiqueta + campo + ayuda/error. `required` agrega el asterisco.
 * Usa <div> (no <label>) para poder envolver controles compuestos; el <label> apunta al campo con `htmlFor`.
 */
export function Field({ label, htmlFor, required, hint, error, children, className = '' }: {
  label?: ReactNode; htmlFor?: string; required?: boolean; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
          {label}{required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {children}
      {error ? <p className="text-xs text-red-600 mt-1">{error}</p> : hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { error?: boolean };
// `prefix` es también un atributo HTML (string): se omite para aceptar un icono o texto.
type AddonProps = Omit<InputProps, 'prefix'> & { prefix?: ReactNode; suffix?: ReactNode };

export const TextInput = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = '', ...props }, ref) => <input ref={ref} className={`${fieldClass(error)} ${className}`} {...props} />,
);
TextInput.displayName = 'TextInput';

/** Input con texto o icono pegado a la izquierda (prefix) o a la derecha (suffix): "$", "%", "kg", "x". */
export const AddonInput = forwardRef<HTMLInputElement, AddonProps>(
  ({ prefix, suffix, error, className = '', ...props }, ref) => (
    <div className={`flex items-stretch rounded-lg border bg-white focus-within:ring-2 transition-colors ${error ? 'border-red-400 focus-within:ring-red-200' : 'border-gray-300 focus-within:ring-app-200 focus-within:border-app-500'} ${props.disabled ? 'bg-gray-50' : ''}`}>
      {prefix && <span className="flex items-center px-3 text-sm text-gray-500 bg-gray-50 border-r border-gray-200 rounded-l-lg">{prefix}</span>}
      <input ref={ref} className={`min-w-0 flex-1 h-10 bg-transparent px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:text-gray-500 ${className}`} {...props} />
      {suffix && <span className="flex items-center px-3 text-sm text-gray-500 bg-gray-50 border-l border-gray-200 rounded-r-lg">{suffix}</span>}
    </div>
  ),
);
AddonInput.displayName = 'AddonInput';

/** Número (cantidades, factores). Devuelve string para no perder lo que el usuario escribe. */
export const NumberInput = forwardRef<HTMLInputElement, AddonProps>(
  ({ prefix, suffix, ...props }, ref) =>
    prefix || suffix
      ? <AddonInput ref={ref} type="number" inputMode="decimal" prefix={prefix} suffix={suffix} {...props} />
      : <TextInput ref={ref} type="number" inputMode="decimal" {...props} />,
);
NumberInput.displayName = 'NumberInput';

/** Dinero: número con el símbolo de la moneda a la izquierda. */
export const MoneyInput = forwardRef<HTMLInputElement, Omit<InputProps, 'prefix'> & { currency?: string }>(
  ({ currency = '$', step = '0.01', min = 0, ...props }, ref) => <NumberInput ref={ref} prefix={currency} step={step} min={min} {...props} />,
);
MoneyInput.displayName = 'MoneyInput';

export const DateInput = forwardRef<HTMLInputElement, InputProps>((props, ref) => <TextInput ref={ref} type="date" {...props} />);
DateInput.displayName = 'DateInput';

export const SelectInput = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }>(
  ({ error, className = '', children, ...props }, ref) => <select ref={ref} className={`${fieldClass(error)} pr-8 ${className}`} {...props}>{children}</select>,
);
SelectInput.displayName = 'SelectInput';

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }>(
  ({ error, className = '', rows = 3, ...props }, ref) => <textarea ref={ref} rows={rows} className={`${fieldClass(error)} h-auto py-2 ${className}`} {...props} />,
);
TextArea.displayName = 'TextArea';

/** Color: muestra + código hex editables. */
export function ColorInput({ value, onChange, disabled }: { value: string; onChange: (hex: string) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label="Elegir color" className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer flex-shrink-0 disabled:cursor-not-allowed" />
      <TextInput value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} maxLength={7} className="font-mono uppercase" placeholder="#000000" />
    </div>
  );
}

/** Casilla con texto. */
export function Checkbox({ label, description, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={`inline-flex items-start gap-2 text-sm text-gray-700 cursor-pointer ${props.disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}>
      <input type="checkbox" className="mt-0.5 w-4 h-4 rounded border-gray-300 text-app-600 focus:ring-app-500" {...props} />
      <span>{label}{description && <span className="block text-xs text-gray-500">{description}</span>}</span>
    </label>
  );
}

/** Interruptor encendido/apagado (activar opciones de configuración). */
export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; disabled?: boolean }) {
  const id = useId();
  const btn = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500 focus-visible:ring-offset-1 disabled:opacity-50 ${checked ? 'bg-app-600' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
  if (!label) return btn;
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        {description && <span className="block text-xs text-gray-500 mt-0.5">{description}</span>}
      </label>
      {btn}
    </div>
  );
}

/** Opciones excluyentes. `variant="cards"` para pocas opciones con descripción. */
export function RadioGroup<T extends string>({ value, onChange, options, variant = 'list', name }: {
  value: T; onChange: (v: T) => void; name?: string;
  options: { value: T; label: ReactNode; description?: ReactNode; disabled?: boolean }[];
  variant?: 'list' | 'cards' | 'segmented';
}) {
  const auto = useId();
  const n = name ?? auto;
  if (variant === 'segmented') {
    return (
      <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-0.5" role="radiogroup">
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} disabled={o.disabled} onClick={() => onChange(o.value)}
            className={`px-3 h-8 text-sm rounded-md transition-colors ${value === o.value ? 'bg-white text-app-700 font-medium shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            {o.label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className={variant === 'cards' ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'space-y-2'} role="radiogroup">
      {options.map((o) => (
        <label key={o.value} className={`flex items-start gap-2 text-sm cursor-pointer ${variant === 'cards' ? `rounded-lg border p-3 ${value === o.value ? 'border-app-500 bg-app-50 ring-1 ring-app-500' : 'border-gray-200 hover:border-gray-300'}` : ''} ${o.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <input type="radio" name={n} checked={value === o.value} disabled={o.disabled} onChange={() => onChange(o.value)} className="mt-0.5 w-4 h-4 border-gray-300 text-app-600 focus:ring-app-500" />
          <span><span className="font-medium text-gray-900">{o.label}</span>{o.description && <span className="block text-xs text-gray-500 mt-0.5">{o.description}</span>}</span>
        </label>
      ))}
    </div>
  );
}

export interface Option<V extends string | number = string | number> { value: V; label: string; hint?: string }

/**
 * Selector con búsqueda (listas largas: clientes, productos, insumos).
 * `multiple` permite varios valores (se muestran como chips).
 */
export function Combobox<V extends string | number>(props: {
  options: Option<V>[]; placeholder?: string; disabled?: boolean; error?: boolean; emptyText?: string; clearable?: boolean;
} & ({ multiple?: false; value: V | null; onChange: (v: V | null) => void } | { multiple: true; value: V[]; onChange: (v: V[]) => void })) {
  const { options, placeholder = 'Seleccionar…', disabled, error, emptyText = 'Sin resultados', clearable = true } = props;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = props.multiple ? props.value : props.value === null ? [] : [props.value];
  const isSel = (v: V) => selected.includes(v);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.label.toLowerCase().includes(t) || o.hint?.toLowerCase().includes(t)) : options;
  }, [options, q]);

  const pick = (v: V) => {
    if (props.multiple) props.onChange(isSel(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    else { props.onChange(v); setOpen(false); }
    setQ('');
  };
  const label = (v: V) => options.find((o) => o.value === v)?.label ?? String(v);

  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)}
        className={`${fieldClass(error)} flex items-center gap-1 text-left ${props.multiple && selected.length ? 'h-auto min-h-10 py-1 flex-wrap' : ''}`}>
        {selected.length === 0 ? <span className="flex-1 text-gray-400 truncate">{placeholder}</span>
          : props.multiple ? (
            <span className="flex-1 flex flex-wrap gap-1">
              {selected.map((v) => (
                <span key={String(v)} className="inline-flex items-center gap-1 rounded-md bg-app-50 text-app-700 px-2 py-0.5 text-xs">
                  {label(v)}
                  <X className="w-3 h-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); pick(v); }} />
                </span>
              ))}
            </span>
          ) : <span className="flex-1 truncate">{label(selected[0])}</span>}
        {clearable && selected.length > 0 && !disabled && (
          <X className="w-4 h-4 text-gray-400 hover:text-gray-700" onClick={(e) => { e.stopPropagation(); props.multiple ? props.onChange([]) : props.onChange(null); }} />
        )}
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-xl">
          <div className="p-2 border-b border-gray-100 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="w-full h-8 rounded-md border border-gray-200 pl-8 pr-2 text-sm focus:outline-none focus:border-app-500" />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? <li className="px-3 py-2 text-sm text-gray-400">{emptyText}</li> : filtered.map((o) => (
              <li key={String(o.value)} role="option" aria-selected={isSel(o.value)} onClick={() => pick(o.value)}
                className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${isSel(o.value) ? 'text-app-700 font-medium' : 'text-gray-700'}`}>
                <span className="flex-1 min-w-0"><span className="block truncate">{o.label}</span>{o.hint && <span className="block text-xs text-gray-400 truncate">{o.hint}</span>}</span>
                {isSel(o.value) && <Check className="w-4 h-4 flex-shrink-0" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Buscador de listados (con lupa). */
export function SearchInput({ value, onChange, placeholder = 'Buscar…', className = '' }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${fieldClass()} pl-9`} />
    </div>
  );
}

/** Barra de filtros de un listado: tarjeta con los filtros en fila (en celular se apilan). */
export function FilterBar({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col lg:flex-row lg:items-end gap-3">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{children}</div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

/** Rejilla de campos de formulario. */
export function FormGrid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 | 4 }) {
  const c = { 1: '', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-2 lg:grid-cols-4' }[cols];
  return <div className={`grid grid-cols-1 ${c} gap-4`}>{children}</div>;
}

/** Pie de formulario: botones a la derecha (Cancelar, luego la acción principal). */
export function FormActions({ children, sticky = false }: { children: ReactNode; sticky?: boolean }) {
  return (
    <div className={`flex flex-col-reverse sm:flex-row sm:justify-end gap-2 ${sticky ? 'sticky bottom-0 z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-white/95 backdrop-blur border-t border-gray-200' : 'pt-4 mt-2 border-t border-gray-100'}`}>
      {children}
    </div>
  );
}
