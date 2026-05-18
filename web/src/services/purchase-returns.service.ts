import api from './api.service';

export interface PurchaseReturnItem {
  id: number;
  purchaseReturnId: number;
  purchaseOrderItemId: number | null;
  variantId: number | null;
  inputId: number | null;
  inputVariantId: number | null;
  description: string | null;
  quantity: number;
  unitCost: number;
  subtotal: number;
}

export interface PurchaseReturn {
  id: number;
  returnNumber: string;
  purchaseOrderId: number;
  supplierId: number;
  reason: string;
  notes: string | null;
  total: number;
  createdById: number | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  supplier?: { id: number; name: string; code: string };
  purchaseOrder?: { id: number; orderNumber: string; status: string };
  items?: PurchaseReturnItem[];
}

export interface ReturnableItem {
  purchaseOrderItemId: number;
  variantId: number | null;
  inputId: number | null;
  inputVariantId: number | null;
  description: string;
  groupName: string;
  colorName: string | null;
  sizeName: string | null;
  unitCost: number;
  quantityReceived: number;
  quantityReturned: number;
  returnable: number;
}

export interface ReturnableOrder {
  purchaseOrder: {
    id: number;
    orderNumber: string;
    status: string;
    supplier?: { id: number; name: string; code: string };
  };
  items: ReturnableItem[];
}

export interface PurchaseReturnStats {
  total: number;
  totalValue: number;
  lastReturn: string | null;
}

export interface CreatePurchaseReturnInput {
  purchaseOrderId: number;
  reason: string;
  notes?: string;
  items: { purchaseOrderItemId: number; quantity: number }[];
}

const baseUrl = '/purchase-returns';

// Listar devoluciones
export async function getReturns(): Promise<PurchaseReturn[]> {
  const response = await api.get<PurchaseReturn[]>(baseUrl);
  return response.data ?? [];
}

// Detalle de una devolución
export async function getReturnById(id: number): Promise<PurchaseReturn> {
  const response = await api.get<PurchaseReturn>(`${baseUrl}/${id}`);
  return response.data!;
}

// Estadísticas
export async function getStats(): Promise<PurchaseReturnStats> {
  const response = await api.get<PurchaseReturnStats>(`${baseUrl}/stats`);
  return response.data!;
}

// Ítems devolubles de una orden de compra (para precargar)
export async function getReturnable(purchaseOrderId: number): Promise<ReturnableOrder> {
  const response = await api.get<ReturnableOrder>(`${baseUrl}/returnable/${purchaseOrderId}`);
  return response.data!;
}

// Crear una devolución (revierte el stock de inmediato)
export async function createReturn(data: CreatePurchaseReturnInput): Promise<PurchaseReturn> {
  const response = await api.post<PurchaseReturn>(baseUrl, data);
  return response.data!;
}
