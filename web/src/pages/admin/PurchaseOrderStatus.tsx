import { Badge, type Tone } from '../../components/ui';
import { getStatusLabel, type PurchaseOrderStatus } from '../../services/purchase-orders.service';

/** Tono del estado de una orden de compra (colores con significado, sección 1 del estándar). */
export const PURCHASE_ORDER_STATUS_TONE: Record<PurchaseOrderStatus, Tone> = {
  DRAFT: 'gray',
  SENT: 'blue',
  CONFIRMED: 'app',
  PARTIAL: 'yellow',
  RECEIVED: 'green',
  CANCELLED: 'red',
};

export function PurchaseOrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return <Badge tone={PURCHASE_ORDER_STATUS_TONE[status] ?? 'gray'}>{getStatusLabel(status)}</Badge>;
}

/** Dinero en pesos colombianos sin decimales de relleno. */
export const money = (n: number | string | null | undefined) => '$' + Number(n || 0).toLocaleString('es-CO');
