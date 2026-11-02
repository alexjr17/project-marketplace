// Utilidades de presentación compartidas por Resumen, Pedidos, Despachos, Pagos y Clientes.
import type { Tone } from '../../components/ui';
import type { OrderStatus } from '../../types/order';

/** Tono del Badge por estado del pedido. */
export const ORDER_TONE: Record<OrderStatus, Tone> = {
  pending: 'yellow',
  paid: 'blue',
  processing: 'app',
  shipped: 'purple',
  delivered: 'green',
  cancelled: 'red',
};

/** Dinero en pesos, sin decimales: $37.667 */
export const money = (n: number | null | undefined) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;

/** Fecha corta con hora: 01 nov 2026, 10:30 */
export const fmtDateTime = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

/** Fecha corta: 01 nov 2026 */
export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
