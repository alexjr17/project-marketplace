import { useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronDown, Search } from 'lucide-react';

export interface MultiSelectOption {
  id: number;
  label: string;
  hex?: string; // opcional: muestra un swatch de color
}

interface Props {
  options: MultiSelectOption[];
  value: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
}

/** Selección múltiple con buscador y etiquetas, con el aspecto de los campos del kit. A diferencia de Combobox multiple, muestra la muestra de color (hex). */
export default function MultiSelect({ options, value, onChange, placeholder = 'Buscar…' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = useMemo(() => value.map((id) => options.find((o) => o.id === id)).filter(Boolean) as MultiSelectOption[], [value, options]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => !value.includes(o.id) && (!q || o.label.toLowerCase().includes(q)));
  }, [options, value, query]);

  const add = (id: number) => { onChange([...value, id]); setQuery(''); };
  const remove = (id: number) => onChange(value.filter((x) => x !== id));

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => setOpen(true)}
        className="min-h-10 w-full rounded-lg border border-gray-300 bg-white px-2 py-1 flex flex-wrap items-center gap-1 cursor-text transition-colors focus-within:ring-2 focus-within:ring-app-200 focus-within:border-app-500"
      >
        {selected.map((o) => (
          <span key={o.id} className="inline-flex items-center gap-1 rounded-md bg-app-50 text-app-700 pl-1.5 pr-1 py-0.5 text-xs">
            {o.hex && <span className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: o.hex }} />}
            {o.label}
            <button type="button" onClick={(e) => { e.stopPropagation(); remove(o.id); }} title={`Quitar ${o.label}`} className="rounded p-0.5 hover:bg-app-100"><X className="w-3 h-3" /></button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] h-7 bg-transparent px-1 text-sm text-gray-900 placeholder:text-gray-400 outline-none"
        />
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border border-gray-200 bg-white shadow-xl max-h-60 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400 flex items-center gap-2"><Search className="w-4 h-4" /> {query ? 'Sin resultados' : 'Todo seleccionado'}</div>
          ) : filtered.map((o) => (
            <button key={o.id} type="button" onClick={() => add(o.id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50">
              {o.hex && <span className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: o.hex }} />}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
