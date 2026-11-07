import type { OrderCustomization } from '../types/design';
import api from './api.service';
import { ApiError, type PageMeta } from '../lib/http';
import type { WompiCheckoutData } from './wompi.service';
import type { OrderItem, OrderStatus, PaymentMethod, ShippingInfo } from '../types/order';

/** Entrada del historial de estados tal como llega del API (fechas en texto). */
export interface ApiStatusHistoryEntry {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedBy: string;
  changedAt: string;
  note?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  cancellationReason?: string;
  evidences?: ApiPaymentEvidence[];
}

/** Evidencia de pago tal como llega del API. */
export interface ApiPaymentEvidence {
  id: string;
  type: 'receipt' | 'transfer' | 'screenshot' | 'other';
  url: string;
  description?: string;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface ApiOrder {
  id: number;
  orderNumber: string;
  userId: number;
  userName?: string | null;
  userEmail?: string | null;
  user?: {
    id: number;
    name: string;
    email: string;
  };
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  tax: number;
  total: number;
  status: OrderStatus;
  paymentMethod: string;
  paymentRef?: string;
  shipping: ShippingInfo;
  trackingNumber?: string;
  trackingUrl?: string;
  notes?: string;
  statusHistory: ApiStatusHistoryEntry[];
  paidAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderInput {
  items: {
    productId: number;
    size: string;
    color: string;
    quantity: number;
    customization?: OrderCustomization;
  }[];
  shipping: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    department?: string;
    postalCode?: string;
    country?: string;
    notes?: string;
  };
  paymentMethod: PaymentMethod;
  paymentRef?: string;
  notes?: string;
  couponCode?: string;
}

// Backend espera estados en mayúsculas
type BackendOrderStatus = 'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface ChangeStatusInput {
  status: BackendOrderStatus | OrderStatus;
  note?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  cancellationReason?: string;
  evidences?: {
    type: 'receipt' | 'transfer' | 'screenshot' | 'other';
    url: string;
    description?: string;
  }[];
}

export interface OrdersFilters {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  search?: string;
  userId?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface OrdersResponse {
  data: ApiOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const ordersService = {
  // Obtener todos los pedidos (admin)
  async getAll(filters?: OrdersFilters): Promise<OrdersResponse> {
    // El backend devuelve { success, data, meta } donde meta tiene la paginación
    const response = await api.get<ApiOrder[]>('/orders', filters);

    // Mapear 'meta' del backend a 'pagination' del frontend
    const meta = (response.meta as PageMeta | undefined) || response.pagination;
    const data = response.data || [];

    return {
      data,
      pagination: meta || {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    };
  },

  // Obtener pedido por ID
  async getById(id: number): Promise<ApiOrder | null> {
    try {
      const response = await api.get<ApiOrder>(`/orders/${id}`);
      return response.data || null;
    } catch {
      return null;
    }
  },

  // Obtener pedido por número de orden
  async getByNumber(orderNumber: string): Promise<ApiOrder | null> {
    try {
      const response = await api.get<ApiOrder>(`/orders/number/${orderNumber}`);
      return response.data || null;
    } catch {
      return null;
    }
  },

  // Crear nuevo pedido
  async create(data: CreateOrderInput): Promise<ApiOrder> {
    const response = await api.post<ApiOrder>('/orders', data);
    if (!response.data) throw new Error(response.message || 'Error creando pedido');
    return response.data;
  },

  // Cambiar estado del pedido
  async changeStatus(orderId: number, data: ChangeStatusInput): Promise<ApiOrder> {
    const response = await api.patch<ApiOrder>(`/orders/${orderId}/status`, data);
    if (!response.data) throw new Error(response.message || 'Error cambiando estado');
    return response.data;
  },

  // Mi pedido por número (cliente). /orders/number/{n} es solo de admin.
  // null solo si no existe (404); otro error se propaga para no confundirlo con "no existe".
  async getMyByNumber(orderNumber: string): Promise<ApiOrder | null> {
    try {
      const response = await api.get<ApiOrder>(`/orders/my/number/${encodeURIComponent(orderNumber)}`);
      return response.data || null;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  // Cancelar un pedido propio pendiente (devuelve el stock).
  async cancelMy(orderId: number): Promise<void> {
    await api.post(`/orders/my/${orderId}/cancel`);
  },

  // Datos firmados por el servidor para abrir el widget de Wompi de un pedido propio y pendiente.
  async wompiCheckout(orderId: number): Promise<WompiCheckoutData> {
    const response = await api.post<WompiCheckoutData>(`/orders/my/${orderId}/wompi-checkout`);
    if (!response.data) throw new Error(response.message || 'No se pudo preparar el pago');
    return response.data;
  },

  // Confirma el pago consultando la transacción en Wompi desde el backend.
  async confirmWompiPayment(orderNumber: string, transactionId: string): Promise<{ order: ApiOrder | null; message: string }> {
    const response = await api.post<ApiOrder>(`/orders/confirm-payment/${encodeURIComponent(orderNumber)}`, { transactionId });
    return { order: response.data || null, message: response.message || '' };
  },

  // Obtener mis pedidos (usuario autenticado)
  async getMyOrders(filters?: { page?: number; limit?: number }): Promise<OrdersResponse> {
    // El backend devuelve { success, data, meta } donde meta tiene la paginación
    const response = await api.get<ApiOrder[]>('/orders/my', filters);

    // Mapear 'meta' del backend a 'pagination' del frontend
    const meta = (response.meta as PageMeta | undefined) || response.pagination;

    return {
      data: response.data || [],
      pagination: meta || {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    };
  },
};

export default ordersService;
