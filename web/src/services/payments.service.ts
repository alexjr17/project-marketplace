import api from './api.service';
import type { PageMeta } from '../lib/http';

/** Devuelve `data` de la respuesta o lanza con el mensaje del backend. api.service ya
 *  desenvuelve el sobre {success, data}: leer `response.data.data` daba undefined. */
const unwrap = <T,>(response: { data?: T; message?: string }): T => {
  if (response.data === undefined || response.data === null) throw new Error(response.message || 'Respuesta vacía del servidor');
  return response.data;
};

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'APPROVED'
  | 'DECLINED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUNDED'
  | 'PARTIAL_REFUND';

export interface Payment {
  id: number;
  orderId: number;
  orderNumber?: string;
  transactionId: string | null;
  paymentMethod: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  statusLabel: string;
  receiptUrl: string | null;
  receiptData: string | null;
  payerName: string | null;
  payerEmail: string | null;
  payerPhone: string | null;
  payerDocument: string | null;
  failureReason: string | null;
  failureCode: string | null;
  verifiedBy: number | null;
  verifiedByName?: string;
  verifiedAt: string | null;
  notes: string | null;
  refundedAmount: number;
  refundedAt: string | null;
  refundReason: string | null;
  initiatedAt: string;
  paidAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentInput {
  orderId: number;
  transactionId?: string;
  paymentMethod: string;
  amount: number;
  currency?: string;
  payerName?: string;
  payerEmail?: string;
  payerPhone?: string;
  payerDocument?: string;
}

export interface UpdatePaymentInput {
  receiptUrl?: string;
  receiptData?: string;
  notes?: string;
}

export interface VerifyPaymentInput {
  approved: boolean;
  notes?: string;
}

export interface RefundPaymentInput {
  amount?: number;
  reason: string;
}

export interface PaymentStats {
  total: number;
  pending: number;
  byStatus: Record<string, number>;
  byMethod: Array<{
    method: string;
    count: number;
    total: number;
  }>;
  revenue: {
    total: number;
    refunded: number;
    net: number;
  };
}

export interface ListPaymentsQuery {
  page?: number;
  limit?: number;
  status?: PaymentStatus;
  paymentMethod?: string;
  orderId?: number;
  transactionId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: 'initiatedAt' | 'amount' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedPayments {
  data: Payment[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

class PaymentsService {
  // ==================== RUTAS DE USUARIO ====================

  /**
   * Crear intento de pago
   */
  async createPayment(data: CreatePaymentInput): Promise<Payment> {
    const response = await api.post<Payment>(
      '/payments',
      data
    );
    return unwrap(response);
  }

  /**
   * Crear una preferencia de Mercado Pago (Checkout Pro) y obtener la URL de pago.
   */
  async createMercadoPagoPreference(
    orderId: number
  ): Promise<{ initPoint: string | null; preferenceId: string | null; isTestMode: boolean }> {
    const response = await api.post<{ initPoint: string | null; preferenceId: string | null; isTestMode: boolean }>('/payments/mercadopago/preference', { orderId });
    return unwrap(response);
  }

  /**
   * Confirmar un pago de Mercado Pago al volver del checkout (best-effort).
   */
  async confirmMercadoPago(
    orderNumber: string,
    paymentId: string
  ): Promise<{ success: boolean; message: string; status?: string }> {
    // Este endpoint responde {success, message, status} en la raíz (sin `data`).
    const response = await api.get<never>(
      `/webhooks/mercadopago/confirm/${encodeURIComponent(orderNumber)}`,
      { payment_id: paymentId }
    ) as unknown as { success?: boolean; message?: string; status?: string };
    return { success: Boolean(response.success), message: response.message ?? '', status: response.status };
  }

  /**
   * Obtener pagos de mi pedido
   */
  async getMyOrderPayments(orderId: number): Promise<Payment[]> {
    const response = await api.get<Payment[]>(
      `/payments/order/${orderId}`
    );
    return unwrap(response);
  }

  /**
   * Actualizar mi pago (subir comprobante)
   */
  async updateMyPayment(id: number, data: UpdatePaymentInput): Promise<Payment> {
    const response = await api.patch<Payment>(
      `/payments/${id}`,
      data
    );
    return unwrap(response);
  }

  // ==================== RUTAS DE ADMIN ====================

  /**
   * Listar todos los pagos (Admin)
   */
  async listPayments(query?: ListPaymentsQuery): Promise<PaginatedPayments> {
    const response = await api.get<Payment[]>('/payments/all', query);

    // El backend retorna { success, data, meta }
    // api.get() ya parsea esto, así que accedemos directamente
    const meta = (response.meta as PageMeta | undefined) || response.pagination || {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    };

    return {
      data: response.data || [],
      meta,
    };
  }

  /**
   * Obtener todos los pagos de un pedido (Admin)
   */
  async getOrderPayments(orderId: number): Promise<Payment[]> {
    const response = await api.get<Payment[]>(
      `/payments/order/${orderId}/all`
    );
    return unwrap(response);
  }

  /**
   * Obtener pago por ID (Admin)
   */
  async getPaymentById(id: number): Promise<Payment> {
    const response = await api.get<Payment>(
      `/payments/${id}/admin`
    );
    return unwrap(response);
  }

  /**
   * Obtener pago por transactionId (Admin)
   */
  async getPaymentByTransactionId(transactionId: string): Promise<Payment> {
    const response = await api.get<Payment>(
      `/payments/transaction/${transactionId}`
    );
    return unwrap(response);
  }

  /**
   * Actualizar pago (Admin)
   */
  async updatePayment(
    id: number,
    data: {
      status?: PaymentStatus;
      transactionId?: string;
      receiptUrl?: string;
      receiptData?: string;
      failureReason?: string;
      failureCode?: string;
      notes?: string;
    }
  ): Promise<Payment> {
    const response = await api.patch<Payment>(
      `/payments/${id}/admin`,
      data
    );
    return unwrap(response);
  }

  /**
   * Verificar pago manualmente (Admin)
   */
  async verifyPayment(id: number, data: VerifyPaymentInput): Promise<Payment> {
    const response = await api.post<Payment>(
      `/payments/${id}/verify`,
      data
    );
    return unwrap(response);
  }

  /**
   * Reembolsar pago (Admin)
   */
  async refundPayment(id: number, data: RefundPaymentInput): Promise<Payment> {
    const response = await api.post<Payment>(
      `/payments/${id}/refund`,
      data
    );
    return unwrap(response);
  }

  /**
   * Cancelar pago (Admin)
   */
  async cancelPayment(id: number, reason?: string): Promise<Payment> {
    const response = await api.post<Payment>(
      `/payments/${id}/cancel`,
      { reason }
    );
    return unwrap(response);
  }

  /**
   * Obtener estadísticas de pagos (Admin)
   */
  async getPaymentStats(): Promise<PaymentStats> {
    const response = await api.get<PaymentStats>('/payments/stats');
    return unwrap(response);
  }
}

export default new PaymentsService();
