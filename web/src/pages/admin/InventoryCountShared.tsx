import { Badge, type Tone } from '../../components/ui';
import { STATUS_LABELS, type InventoryCountStatus } from '../../services/inventory-counts.service';

/** Tono del estado de un conteo físico (colores con significado del estándar). */
export const COUNT_STATUS_TONE: Record<InventoryCountStatus, Tone> = {
  DRAFT: 'gray',
  IN_PROGRESS: 'blue',
  PENDING_APPROVAL: 'yellow',
  APPROVED: 'green',
  CANCELLED: 'red',
};

export function CountStatusBadge({ status }: { status: InventoryCountStatus }) {
  return <Badge tone={COUNT_STATUS_TONE[status] ?? 'gray'}>{STATUS_LABELS[status]}</Badge>;
}

export const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('es-CO') : '—');
