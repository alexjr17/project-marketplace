import api from './api.service';
import type { OrderStatus, PaymentMethod } from '../types/order';

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
    designFront?: string;
    designBack?: string;
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

export interface StatusHistoryEntry {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedBy: string;
  changedAt: string;
  note?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  cancellationReason?: string;
  evidences?: PaymentEvidence[];
}

export interface PaymentEvidence {
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
  statusHistory: StatusHistoryEntry[];
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
    customization?: {
      text?: string;
      image?: string;
      position?: string;
      notes?: string;
    };
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
    const response = await api.get<ApiOrder[]>('/orders', filters) as any;

    console.log('[ordersService.getAll] Raw response:', response);

    // Mapear 'meta' del backend a 'pagination' del frontend
    const meta = response.meta || response.pagination;
    const data = response.data || [];

    console.log('[ordersService.getAll] Extracted data:', data);
    console.log('[ordersService.getAll] Extracted meta:', meta);

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

  // Obtener mis pedidos (usuario autenticado)
  async getMyOrders(filters?: { page?: number; limit?: number }): Promise<OrdersResponse> {
    // El backend devuelve { success, data, meta } donde meta tiene la paginación
    const response = await api.get<ApiOrder[]>('/orders/my', filters) as any;

    // Mapear 'meta' del backend a 'pagination' del frontend
    const meta = response.meta || response.pagination;

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

  // Obtener pedidos por email (para usuarios no autenticados)
  async getByEmail(email: string): Promise<ApiOrder[]> {
    try {
      const response = await api.get<ApiOrder[]>('/orders', { search: email });
      return response.data || [];
    } catch {
      return [];
    }
  },

  // Actualizar información de tracking
  async updateTracking(
    orderId: number,
    trackingNumber: string,
    trackingUrl?: string
  ): Promise<ApiOrder> {
    const response = await api.patch<ApiOrder>(`/orders/${orderId}/tracking`, {
      trackingNumber,
      trackingUrl,
    });
    if (!response.data) throw new Error('Error actualizando tracking');
    return response.data;
  },

  // Agregar nota al pedido
  async addNote(orderId: number, note: string): Promise<ApiOrder> {
    const response = await api.patch<ApiOrder>(`/orders/${orderId}/notes`, { note });
    if (!response.data) throw new Error('Error agregando nota');
    return response.data;
  },
};

export default ordersService;
