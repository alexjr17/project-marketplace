import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, UserPlus, Loader2, UserCog, User, RotateCcw } from 'lucide-react';
import * as posService from '../../services/pos.service';
import type { CustomerSearchResult } from '../../services/pos.service';
import CustomerFormModal from './CustomerFormModal';

export interface SelectedCustomer {
  id?: number; // sin id = cliente nuevo (se registra al finalizar la venta)
  name: string;
  phone?: string | null;
  email?: string | null;
  cedula?: string | null;
  photo?: string | null;
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
  const [showForm, setShowForm] = useState(false);
  const [formInitial, setFormInitial] = useState<SelectedCustomer | null>(null);
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

  // Tomar el nombre escrito como cliente nuevo (solo nombre); los datos
  // completos quedan opcionales y pueden añadirse luego en el cobro.
  const selectTypedName = () => {
    const name = query.trim();
    if (!name) return;
    onChange({ name });
    setOpen(false);
    setQuery('');
  };

  // Abre el formulario completo (registrar nuevo con datos reales, opcional).
  const openNewForm = (prefillName?: string) => {
    setFormInitial(prefillName ? { name: prefillName } : null);
    setShowForm(true);
    setOpen(false);
  };

  // Abre el formulario para completar/editar el cliente actualmente elegido.
  const openEditForm = () => {
    if (value) setFormInitial(value);
    setShowForm(true);
  };

  const handleFormSave = (c: SelectedCustomer) => {
    onChange(c);
    setShowForm(false);
    setQuery('');
  };

  // Limpiar y volver al cliente por defecto (el padre lo convierte a "Consumidor Final").
  const clearToDefault = () => {
    onChange(null);
    setQuery('');
    setOpen(false);
  };

  // El término escrito ¿ya coincide exactamente con un resultado?
  const exactMatch = results.some((c) => c.name.toLowerCase() === query.trim().toLowerCase());

  // ¿Hay un cliente "real" seleccionado (no el consumidor final por defecto)?
  const hasRealCustomer = !!value && (!!value.id || value.name !== 'Consumidor Final');

  return (
    <div className="relative" ref={boxRef}>
      {/* Campo de cliente: prefijo "Cliente" para que se entienda de inmediato.
          Al enfocar se limpia para buscar; iconos para editar y volver al default. */}
      <div className="flex items-center gap-1.5 pl-2 pr-1.5 bg-white border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
        <div className="flex items-center gap-1 pr-2 mr-0.5 border-r border-gray-200 text-gray-500 flex-shrink-0">
          {open ? <Search className="w-4 h-4" /> : <User className="w-4 h-4" />}
          <span className="text-xs font-medium">Cliente</span>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={open ? query : (value?.name ?? '')}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { setQuery(''); setOpen(true); }}
          placeholder={open ? 'Buscar o registrar...' : 'Consumidor Final'}
          autoComplete="off"
          className="flex-1 min-w-0 py-2 text-sm bg-transparent outline-none"
        />
        {/* Acciones del cliente seleccionado (no en modo búsqueda) */}
        {hasRealCustomer && !open && (
          <>
            <button
              type="button"
              onClick={openEditForm}
              title="Editar / completar datos del cliente"
              className="p-1 text-gray-400 hover:text-blue-600 flex-shrink-0"
            >
              <UserCog className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={clearToDefault}
              title="Quitar cliente (volver a Consumidor Final)"
              className="p-1 text-gray-400 hover:text-red-600 flex-shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
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
              onMouseDown={(e) => e.preventDefault()}
              onClick={selectTypedName}
              className="w-full text-left px-3 py-2 hover:bg-green-50 flex items-center gap-2 text-green-700 border-t"
            >
              <UserPlus className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">Usar cliente: <strong>{query.trim()}</strong></span>
            </button>
          )}
          {!loading && query.trim().length < 2 && (
            <div className="px-3 py-2 text-xs text-gray-400 border-b">Escribe al menos 2 letras para buscar.</div>
          )}
          {/* Registrar cliente nuevo con información completa (siempre disponible) */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => openNewForm(query.trim() || undefined)}
            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center gap-2 text-blue-700 border-t bg-gray-50 font-medium"
          >
            <UserPlus className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">Registrar con datos completos (opcional)</span>
          </button>
        </div>
      )}

      <CustomerFormModal
        isOpen={showForm}
        initial={formInitial}
        onClose={() => setShowForm(false)}
        onSave={handleFormSave}
      />
    </div>
  );
}
