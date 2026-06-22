import api from './api.service';

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
    const response = await api.post<{ success: boolean; message: string; data: Payment }>(
      '/payments',
      data
    );
    return response.data.data;
  }

  /**
   * Crear una preferencia de Mercado Pago (Checkout Pro) y obtener la URL de pago.
   */
  async createMercadoPagoPreference(
    orderId: number
  ): Promise<{ initPoint: string | null; preferenceId: string | null; isTestMode: boolean }> {
    const response = await api.post<{
      success: boolean;
      data: { initPoint: string | null; preferenceId: string | null; isTestMode: boolean };
    }>('/payments/mercadopago/preference', { orderId });
    return response.data.data;
  }

  /**
   * Confirmar un pago de Mercado Pago al volver del checkout (best-effort).
   */
  async confirmMercadoPago(
    orderNumber: string,
    paymentId: string
  ): Promise<{ success: boolean; message: string; status?: string }> {
    const response = await api.get<{ success: boolean; message: string; status?: string }>(
      `/webhooks/mercadopago/confirm/${encodeURIComponent(orderNumber)}`,
      { payment_id: paymentId }
    );
    return (response.data ?? { success: false, message: 'Sin respuesta' }) as {
      success: boolean;
      message: string;
      status?: string;
    };
  }

  /**
   * Obtener pagos de mi pedido
   */
  async getMyOrderPayments(orderId: number): Promise<Payment[]> {
    const response = await api.get<{ success: boolean; data: Payment[] }>(
      `/payments/order/${orderId}`
    );
    return response.data.data;
  }

  /**
   * Actualizar mi pago (subir comprobante)
   */
  async updateMyPayment(id: number, data: UpdatePaymentInput): Promise<Payment> {
    const response = await api.patch<{ success: boolean; message: string; data: Payment }>(
      `/payments/${id}`,
      data
    );
    return response.data.data;
  }

  // ==================== RUTAS DE ADMIN ====================

  /**
   * Listar todos los pagos (Admin)
   */
  async listPayments(query?: ListPaymentsQuery): Promise<PaginatedPayments> {
    const response = await api.get<Payment[]>('/payments/all', query) as any;
    console.log('[paymentsService] Raw response:', response);
    console.log('[paymentsService] response.data:', response.data);
    console.log('[paymentsService] response.meta:', response.meta);

    // El backend retorna { success, data, meta }
    // api.get() ya parsea esto, así que accedemos directamente
    const meta = response.meta || response.pagination || {
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
    const response = await api.get<{ success: boolean; data: Payment[] }>(
      `/payments/order/${orderId}/all`
    );
    return response.data.data;
  }

  /**
   * Obtener pago por ID (Admin)
   */
  async getPaymentById(id: number): Promise<Payment> {
    const response = await api.get<{ success: boolean; data: Payment }>(
      `/payments/${id}/admin`
    );
    return response.data.data;
  }

  /**
   * Obtener pago por transactionId (Admin)
   */
  async getPaymentByTransactionId(transactionId: string): Promise<Payment> {
    const response = await api.get<{ success: boolean; data: Payment }>(
      `/payments/transaction/${transactionId}`
    );
    return response.data.data;
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
    const response = await api.patch<{ success: boolean; message: string; data: Payment }>(
      `/payments/${id}/admin`,
      data
    );
    return response.data.data;
  }

  /**
   * Verificar pago manualmente (Admin)
   */
  async verifyPayment(id: number, data: VerifyPaymentInput): Promise<Payment> {
    const response = await api.post<{ success: boolean; message: string; data: Payment }>(
      `/payments/${id}/verify`,
      data
    );
    return response.data.data;
  }

  /**
   * Reembolsar pago (Admin)
   */
  async refundPayment(id: number, data: RefundPaymentInput): Promise<Payment> {
    const response = await api.post<{ success: boolean; message: string; data: Payment }>(
      `/payments/${id}/refund`,
      data
    );
    return response.data.data;
  }

  /**
   * Cancelar pago (Admin)
   */
  async cancelPayment(id: number, reason?: string): Promise<Payment> {
    const response = await api.post<{ success: boolean; message: string; data: Payment }>(
      `/payments/${id}/cancel`,
      { reason }
    );
    return response.data.data;
  }

  /**
   * Obtener estadísticas de pagos (Admin)
   */
  async getPaymentStats(): Promise<PaymentStats> {
    const response = await api.get<{ success: boolean; data: PaymentStats }>('/payments/stats');
    return response.data.data;
  }
}

export default new PaymentsService();
