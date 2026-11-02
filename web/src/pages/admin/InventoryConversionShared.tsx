import type { Tone } from '../../components/ui';
import type { ConversionStatus } from '../../services/inventory-conversions.service';

/** Estados de una conversión de inventario: etiqueta y tono con significado (sección 1 del estándar). */
export const CONVERSION_STATUS: Record<ConversionStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Borrador', tone: 'gray' },
  PENDING: { label: 'Pendiente', tone: 'yellow' },
  APPROVED: { label: 'Aprobada', tone: 'green' },
  CANCELLED: { label: 'Cancelada', tone: 'red' },
};

/** Pesos colombianos sin decimales: $37.667. */
export const formatCOP = (value: number | string | null | undefined) =>
  '$' + Math.round(Number(value || 0)).toLocaleString('es-CO');
