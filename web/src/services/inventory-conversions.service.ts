import { api } from './api.service';

// Tipos
export type ConversionStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'CANCELLED';
export type ConversionType = 'MANUAL' | 'TEMPLATE';

export interface ConversionInputItem {
  id: number;
  inputVariantId: number;
  inputCode: string;
  inputName: string;
  variantSku: string;
  colorName: string | null;
  sizeName: string | null;
  unitOfMeasure: string;
  unitCost: number;
  quantity: number;
  totalCost: number;
  availableStock?: number;
  notes: string | null;
}

export interface ConversionOutputItem {
  id: number;
  variantId: number;
  productName: string;
  variantSku: string;
  colorName: string | null;
  sizeName: string | null;
  unitPrice: number;
  quantity: number;
  totalValue: number;
  notes: string | null;
}

export interface InventoryConversion {
  id: number;
  conversionNumber: string;
  conversionType: ConversionType;
  templateId: number | null;
  templateVariantId: number | null;
  template?: {
    id: number;
    name: string;
    sku: string;
  } | null;
  status: ConversionStatus;
  conversionDate: string;
  createdById: number | null;
  createdByName: string | null;
  approvedById: number | null;
  approvedByName: string | null;
  approvedAt: string | null;
  description: string | null;
  notes: string | null;
  inputItems: ConversionInputItem[];
  outputItems: ConversionOutputItem[];
  totalInputCost: number;
  totalOutputCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversionStats {
  total: number;
  byStatus: Record<ConversionStatus, number>;
  lastConversion: string | null;
  totalInputCost: number;
  totalOutputValue: number;
}

export interface CreateConversionData {
  conversionType?: ConversionType;
  templateId?: number;
  templateVariantId?: number;
  conversionDate?: string;
  description?: string;
  notes?: string;
}

export interface AddInputItemData {
  inputVariantId: number;
  quantity: number;
  notes?: string;
}

export interface AddOutputItemData {
  variantId: number;
  quantity: number;
  notes?: string;
}

export interface CreateConversionFromTemplateData {
  templateVariantId: number;
  outputVariantId: number;
  quantity: number;
  conversionDate?: string;
  description?: string;
  notes?: string;
}

// Funciones del servicio
export const inventoryConversionsService = {
  // Listar conversiones
  async listConversions(filters?: {
    status?: ConversionStatus;
    fromDate?: string;
    toDate?: string;
  }): Promise<InventoryConversion[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.fromDate) params.append('fromDate', filters.fromDate);
    if (filters?.toDate) params.append('toDate', filters.toDate);

    const queryString = params.toString();
    const url = `/inventory-conversions${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url);
    return response.data.data || response.data;
  },

  // Obtener conversión por ID
  async getConversionById(id: number): Promise<InventoryConversion> {
    const response = await api.get(`/inventory-conversions/${id}`);
    return response.data.data || response.data;
  },

  // Crear conversión
  async createConversion(data: CreateConversionData): Promise<InventoryConversion> {
    const response = await api.post('/inventory-conversions', data);
    return response.data.data || response.data;
  },

  // Agregar insumo a la conversión
  async addInputItem(conversionId: number, data: AddInputItemData): Promise<InventoryConversion> {
    const response = await api.post(`/inventory-conversions/${conversionId}/input-items`, data);
    return response.data.data || response.data;
  },

  // Actualizar item de insumo
  async updateInputItem(
    conversionId: number,
    itemId: number,
    data: { quantity?: number; notes?: string }
  ): Promise<InventoryConversion> {
    const response = await api.patch(
      `/inventory-conversions/${conversionId}/input-items/${itemId}`,
      data
    );
    return response.data.data || response.data;
  },

  // Eliminar item de insumo
  async removeInputItem(conversionId: number, itemId: number): Promise<InventoryConversion> {
    const response = await api.delete(
      `/inventory-conversions/${conversionId}/input-items/${itemId}`
    );
    return response.data.data || response.data;
  },

  // Agregar producto a la conversión
  async addOutputItem(conversionId: number, data: AddOutputItemData): Promise<InventoryConversion> {
    const response = await api.post(`/inventory-conversions/${conversionId}/output-items`, data);
    return response.data.data || response.data;
  },

  // Actualizar item de producto
  async updateOutputItem(
    conversionId: number,
    itemId: number,
    data: { quantity?: number; notes?: string }
  ): Promise<InventoryConversion> {
    const response = await api.patch(
      `/inventory-conversions/${conversionId}/output-items/${itemId}`,
      data
    );
    return response.data.data || response.data;
  },

  // Eliminar item de producto
  async removeOutputItem(conversionId: number, itemId: number): Promise<InventoryConversion> {
    const response = await api.delete(
      `/inventory-conversions/${conversionId}/output-items/${itemId}`
    );
    return response.data.data || response.data;
  },

  // Enviar a aprobación
  async submitForApproval(id: number): Promise<InventoryConversion> {
    const response = await api.post(`/inventory-conversions/${id}/submit`);
    return response.data.data || response.data;
  },

  // Aprobar conversión
  async approveConversion(id: number): Promise<InventoryConversion> {
    const response = await api.post(`/inventory-conversions/${id}/approve`);
    return response.data.data || response.data;
  },

  // Cancelar conversión
  async cancelConversion(id: number): Promise<InventoryConversion> {
    const response = await api.post(`/inventory-conversions/${id}/cancel`);
    return response.data.data || response.data;
  },

  // Eliminar conversión
  async deleteConversion(id: number): Promise<void> {
    await api.delete(`/inventory-conversions/${id}`);
  },

  // Obtener estadísticas
  async getStats(): Promise<ConversionStats> {
    const response = await api.get('/inventory-conversions/stats');
    return response.data.data || response.data;
  },

  // Crear conversión desde plantilla
  async createConversionFromTemplate(data: CreateConversionFromTemplateData): Promise<InventoryConversion> {
    const response = await api.post('/inventory-conversions/from-template', data);
    return response.data.data || response.data;
  },
};
