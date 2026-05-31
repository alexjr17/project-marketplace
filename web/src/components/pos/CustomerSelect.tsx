import { useState, useEffect, useRef, useCallback } from 'react';
import { User, Search, X, UserPlus, Loader2 } from 'lucide-react';
import * as posService from '../../services/pos.service';
import type { CustomerSearchResult } from '../../services/pos.service';

export interface SelectedCustomer {
  id?: number; // sin id = cliente nuevo (se registra al finalizar la venta)
  name: string;
  phone?: string | null;
  email?: string | null;
  cedula?: string | null;
}

interface Props {
  value: SelectedCustomer | null;
  onChange: (customer: SelectedCustomer | null) => void;
}

/**
 * Selector de cliente tipo "select2": se escribe para buscar clientes
 * existentes; si no existe, permite registrarlo como nuevo (se crea al
 * finalizar la venta). Pensado para la pantalla principal del POS.
 */
export default function CustomerSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      setResults(await posService.searchCustomers(q.trim()));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => search(query), 250);
    return () => clearTimeout(t);
  }, [query, open, search]);

  const selectExisting = (c: CustomerSearchResult) => {
    onChange({ id: c.id, name: c.name, phone: c.phone, email: c.email, cedula: c.cedula });
    setOpen(false);
    setQuery('');
  };

  const registerNew = () => {
    const name = query.trim();
    if (!name) return;
    onChange({ name });
    setOpen(false);
    setQuery('');
  };

  // El término escrito ¿ya coincide exactamente con un resultado?
  const exactMatch = results.some((c) => c.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="relative" ref={boxRef}>
      {value && !open ? (
        // Cliente seleccionado
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-2 border-blue-200 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2 min-w-0">
            <User className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{value.name}</p>
              <p className="text-xs text-gray-500 truncate">
                {value.id ? (value.cedula ? `CC/NIT ${value.cedula}` : 'Cliente existente') : 'Nuevo · se registra al cobrar'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
              className="text-xs text-blue-600 hover:text-blue-800 px-1"
            >
              Cambiar
            </button>
            <button onClick={() => onChange(null)} className="text-gray-400 hover:text-red-500 p-1" title="Quitar cliente">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        // Buscador
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Buscar o registrar cliente..."
            autoComplete="off"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      {open && (!value || query) && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading && (
            <div className="px-3 py-2 text-sm text-gray-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando...
            </div>
          )}
          {!loading && results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectExisting(c)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0"
            >
              <p className="text-sm font-medium text-gray-900">{c.name}</p>
              <p className="text-xs text-gray-500">
                {c.cedula ? `CC/NIT ${c.cedula}` : 'Sin cédula'}{c.phone ? ` · ${c.phone}` : ''}
              </p>
            </button>
          ))}
          {!loading && query.trim().length >= 2 && !exactMatch && (
            <button
              type="button"
              onClick={registerNew}
              className="w-full text-left px-3 py-2 hover:bg-green-50 flex items-center gap-2 text-green-700 border-t"
            >
              <UserPlus className="w-4 h-4" />
              <span className="text-sm">Registrar nuevo: <strong>{query.trim()}</strong></span>
            </button>
          )}
          {!loading && query.trim().length < 2 && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">Escribe al menos 2 letras para buscar.</div>
          )}
        </div>
      )}
    </div>
  );
}
