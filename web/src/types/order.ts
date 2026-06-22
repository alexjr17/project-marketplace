export type OrderStatus =
  | 'pending'      // Pendiente de pago
  | 'paid'         // Pagado
  | 'processing'   // En preparación
  | 'shipped'      // Enviado
  | 'delivered'    // Entregado
  | 'cancelled';   // Cancelado

export type PaymentMethod = 'credit_card' | 'debit_card' | 'pse' | 'cash' | 'transfer' | 'wompi' | 'pickup' | 'nequi' | 'mercadopago';

export interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  productImage: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  customization?: {
    designFront?: string; // Preview comprimido
    designBack?: string;
    // Imágenes originales para producción (sin compresión)
    originalFront?: string;
    originalBack?: string;
  };
}

export interface ShippingInfo {
  recipientName: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  notes?: string;
}

export interface PaymentEvidence {
  id: string;
  type: 'receipt' | 'transfer' | 'voucher' | 'other';
  url: string;
  description?: string;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface CancellationInfo {
  reason: string;
  cancelledBy: string;
  cancelledAt: Date;
  refundStatus?: 'pending' | 'processing' | 'completed' | 'not_applicable';
  refundAmount?: number;
  refundNote?: string;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedBy: string;
  changedAt: Date;
  note?: string;
  evidences?: PaymentEvidence[];
  trackingNumber?: string;
  trackingUrl?: string;
  cancellationReason?: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  userId: number;
  userName: string;
  userEmail: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  shipping: ShippingInfo;
  trackingNumber?: string;
  trackingUrl?: string;
  notes?: string;
  statusHistory: StatusHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
}

export const EVIDENCE_TYPE_LABELS: Record<PaymentEvidence['type'], string> = {
  receipt: 'Recibo',
  transfer: 'Comprobante de Transferencia',
  voucher: 'Voucher',
  other: 'Otro',
};

// Etiquetas para admin (internas)
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  processing: 'En Preparación',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

// Etiquetas para usuarios (amigables, sin mencionar pago)
export const ORDER_STATUS_USER_LABELS: Record<OrderStatus, string> = {
  pending: 'Recibido',
  paid: 'Confirmado',
  processing: 'Preparando',
  shipped: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  shipped: 'bg-orange-100 text-orange-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  credit_card: 'Tarjeta de Crédito',
  debit_card: 'Tarjeta de Débito',
  pse: 'PSE',
  cash: 'Efectivo',
  transfer: 'Transferencia',
  wompi: 'Wompi',
  pickup: 'Punto Físico',
  nequi: 'Nequi',
  mercadopago: 'Mercado Pago',
};
