import api from './api.service';
import type { Supplier } from './suppliers.service';

export type PurchaseOrderStatus = 'DRAFT' | 'SENT' | 'CONFIRMED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderItem {
  id: number;
  purchaseOrderId: number;
  variantId?: number;
  inputId?: number;
  inputVariantId?: number;
  description?: string;
  quantity: number;
  quantityReceived: number;
  unitCost: number;
  subtotal: number;
  notes?: string;
  variant?: {
    id: number;
    sku: string;
    product: { id: number; name: string; sku: string };
    color?: { id: number; name: string; hexCode: string };
    size?: { id: number; name: string; abbreviation: string };
  };
  input?: {
    id: number;
    code: string;
    name: string;
    inputType?: { id: number; name: string };
  };
  inputVariant?: {
    id: number;
    sku: string;
    input?: { id: number; name: string; code: string };
    color?: { id: number; name: string; hexCode: string };
    size?: { id: number; name: string; abbreviation: string };
  };
}

export interface PurchaseOrder {
  id: number;
  orderNumber: string;
  supplierId: number;
  supplier: Supplier | { id: number; code: string; name: string };
  status: PurchaseOrderStatus;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  orderDate: string;
  expectedDate?: string;
  receivedDate?: string;
  supplierInvoice?: string;
  notes?: string;
  createdById?: number;
  items: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderFilters {
  search?: string;
  status?: PurchaseOrderStatus;
  supplierId?: number;
  fromDate?: string;
  toDate?: string;
}

export interface CreatePurchaseOrderData {
  supplierId: number;
  expectedDate?: string;
  notes?: string;
  items: {
    variantId?: number;
    inputId?: number;
    inputVariantId?: number;
    description?: string;
    quantity: number;
    unitCost: number;
    notes?: string;
  }[];
}

export interface PurchaseOrderStats {
  total: number;
  byStatus: {
    draft: number;
    sent: number;
    confirmed: number;
    partial: number;
    received: number;
    cancelled: number;
  };
  pendingCount: number;
  monthlyTotal: number;
}

// Obtener todas las órdenes
export async function getPurchaseOrders(filters?: PurchaseOrderFilters): Promise<PurchaseOrder[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.append('search', filters.search);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.supplierId) params.append('supplierId', String(filters.supplierId));
  if (filters?.fromDate) params.append('fromDate', filters.fromDate);
  if (filters?.toDate) params.append('toDate', filters.toDate);

  const response = await api.get<PurchaseOrder[]>(`/purchase-orders?${params.toString()}`);
  return response.data || [];
}

// Obtener una orden por ID
export async function getPurchaseOrderById(id: number): Promise<PurchaseOrder> {
  const response = await api.get<PurchaseOrder>(`/purchase-orders/${id}`);
  return response.data!;
}

// Crear orden
export async function createPurchaseOrder(data: CreatePurchaseOrderData): Promise<PurchaseOrder> {
  const response = await api.post<PurchaseOrder>('/purchase-orders', data);
  return response.data!;
}

// Actualizar orden
export async function updatePurchaseOrder(id: number, data: Partial<CreatePurchaseOrderData>): Promise<PurchaseOrder> {
  const response = await api.put<PurchaseOrder>(`/purchase-orders/${id}`, data);
  return response.data!;
}

// Cambiar estado
export async function updateStatus(id: number, status: PurchaseOrderStatus): Promise<PurchaseOrder> {
  const response = await api.patch<PurchaseOrder>(`/purchase-orders/${id}/status`, { status });
  return response.data!;
}

// Recibir items
export async function receiveItems(
  id: number,
  items: { itemId: number; quantityReceived: number }[]
): Promise<PurchaseOrder> {
  const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/receive`, { items });
  return response.data!;
}

// Eliminar orden
export async function deletePurchaseOrder(id: number): Promise<void> {
  await api.delete(`/purchase-orders/${id}`);
}

// Generar número de orden
export async function generateOrderNumber(): Promise<string> {
  const response = await api.get<{ orderNumber: string }>('/purchase-orders/generate-number');
  return response.data!.orderNumber;
}

// Obtener estadísticas
export async function getStats(): Promise<PurchaseOrderStats> {
  const response = await api.get<PurchaseOrderStats>('/purchase-orders/stats');
  return response.data!;
}

// Helper para obtener el label del estado
export function getStatusLabel(status: PurchaseOrderStatus): string {
  const labels: Record<PurchaseOrderStatus, string> = {
    DRAFT: 'Borrador',
    SENT: 'Enviada',
    CONFIRMED: 'Confirmada',
    PARTIAL: 'Parcial',
    RECEIVED: 'Recibida',
    CANCELLED: 'Cancelada',
  };
  return labels[status] || status;
}

