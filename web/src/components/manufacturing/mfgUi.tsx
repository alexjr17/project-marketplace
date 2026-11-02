/**
 * Piezas locales de la app Fábrica, armadas con el kit (components/ui).
 * - MarketBadge / marketLabel: Nacional usa el color de la app, Exportación azul (igual en todas las pantallas).
 * - ActiveBadge: Activo / Inactivo.
 * - RowActions: Editar + Eliminar de una fila.
 */
import { Globe, MapPin, Pencil, Trash2 } from 'lucide-react';
import { Badge, IconButton } from '../ui';
import type { MfgMarket } from '../../types/manufacturing';

export const MARKET_LABEL: Record<MfgMarket, string> = { NATIONAL: 'Nacional', EXPORT: 'Exportación' };

export function MarketBadge({ market }: { market?: MfgMarket | null }) {
  const m: MfgMarket = market === 'EXPORT' ? 'EXPORT' : 'NATIONAL';
  return m === 'EXPORT'
    ? <Badge tone="blue"><Globe className="w-3 h-3" />{MARKET_LABEL.EXPORT}</Badge>
    : <Badge tone="app"><MapPin className="w-3 h-3" />{MARKET_LABEL.NATIONAL}</Badge>;
}

/** Activo / Inactivo. `female` = "Activa" / "Inactiva". */
export function ActiveBadge({ active, female = false }: { active: boolean; female?: boolean }) {
  return <Badge tone={active ? 'green' : 'gray'}>{active ? (female ? 'Activa' : 'Activo') : (female ? 'Inactiva' : 'Inactivo')}</Badge>;
}

export function RowActions({ onEdit, onDelete, editTitle = 'Editar', deleteTitle = 'Eliminar' }: { onEdit?: () => void; onDelete?: () => void; editTitle?: string; deleteTitle?: string }) {
  return (
    <div className="flex items-center justify-end gap-1">
      {onEdit && <IconButton title={editTitle} tone="app" onClick={(e) => { e.stopPropagation(); onEdit(); }}><Pencil className="w-4 h-4" /></IconButton>}
      {onDelete && <IconButton title={deleteTitle} tone="danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 className="w-4 h-4" /></IconButton>}
    </div>
  );
}

/** Filtra por texto en varios campos (búsqueda local de los catálogos). */
export const matchText = (q: string, ...fields: (string | number | null | undefined)[]) => {
  const t = q.trim().toLowerCase();
  return !t || fields.some((f) => f != null && String(f).toLowerCase().includes(t));
};
