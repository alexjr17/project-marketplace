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

/** Multi-select con buscador y etiquetas (estilo Select2). */
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
        className="min-h-[42px] w-full border border-gray-300 rounded-lg px-2 py-1.5 flex flex-wrap items-center gap-1.5 cursor-text focus-within:ring-2 focus-within:ring-orange-200"
      >
        {selected.map((o) => (
          <span key={o.id} className="inline-flex items-center gap-1 bg-orange-50 text-orange-800 border border-orange-200 rounded-full pl-1.5 pr-1 py-0.5 text-xs">
            {o.hex && <span className="w-3 h-3 rounded-full border border-white shadow" style={{ backgroundColor: o.hex }} />}
            {o.label}
            <button type="button" onClick={(e) => { e.stopPropagation(); remove(o.id); }} className="hover:bg-orange-200 rounded-full p-0.5"><X className="w-3 h-3" /></button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] outline-none text-sm bg-transparent py-0.5"
        />
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>

      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400 flex items-center gap-2"><Search className="w-4 h-4" /> {query ? 'Sin resultados' : 'Todo seleccionado'}</div>
          ) : filtered.map((o) => (
            <button key={o.id} type="button" onClick={() => add(o.id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-orange-50">
              {o.hex && <span className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: o.hex }} />}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
