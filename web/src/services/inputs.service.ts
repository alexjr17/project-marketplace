import { http } from '../lib/http';
import api from './api.service';
import type { InputTypeSize } from './input-types.service';

export interface InputColor {
  id: number;
  colorId: number;
  color: {
    id: number;
    name: string;
    slug: string;
    hexCode: string;
  };
}

export interface InputSize {
  id: number;
  sizeId: number;
  size: {
    id: number;
    name: string;
    abbreviation: string;
    sortOrder: number;
  };
}

export interface InputVariant {
  id: number;
  sku: string;
  colorId: number | null;
  sizeId: number | null;
  unitCost: number | string;
  currentStock: number | string;
  minStock: number | string;
  maxStock: number | string;
  isActive: boolean;
  color: {
    id: number;
    name: string;
    hexCode: string;
  } | null;
  size: {
    id: number;
    name: string;
    abbreviation: string;
  } | null;
}

export interface Input {
  id: number;
  code: string;
  inputTypeId: number;
  name: string;
  description: string | null;
  unitOfMeasure: string;
  currentStock: number | string;
  minStock: number | string;
  maxStock: number | string | null;
  unitCost: number | string;
  supplier: string | null;
  supplierCode: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  inputType?: {
    id: number;
    name: string;
    slug: string;
    hasVariants: boolean;
    inputTypeSizes?: InputTypeSize[];
  };
  inputColors?: InputColor[];
  inputSizes?: InputSize[];
  variants?: InputVariant[];
  _count?: {
    batches: number;
    movements: number;
    zoneInputs: number;
    variants: number;
  };
}

export interface CreateInputDto {
  code: string;
  inputTypeId: number;
  name: string;
  description?: string;
  unitOfMeasure: string;
  minStock: number;
  maxStock?: number;
  unitCost: number;
  supplier?: string;
  supplierCode?: string;
  notes?: string;
  colorIds?: number[];
  sizeIds?: number[];
}

export interface UpdateInputDto {
  code?: string;
  inputTypeId?: number;
  name?: string;
  description?: string;
  unitOfMeasure?: string;
  minStock?: number;
  maxStock?: number;
  unitCost?: number;
  supplier?: string;
  supplierCode?: string;
  notes?: string;
  isActive?: boolean;
}

export interface InputFilters {
  inputTypeId?: number;
  search?: string;
  lowStock?: boolean;
}

export interface InputVariantMovement {
  id: number;
  inputVariantId: number;
  movementType: 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'RESERVA' | 'LIBERACION' | 'DEVOLUCION' | 'MERMA';
  quantity: number | string;
  previousStock: number | string;
  newStock: number | string;
  referenceType: string | null;
  referenceId: number | null;
  reason: string | null;
  notes: string | null;
  userId: number | null;
  unitCost: number | string | null;
  createdAt: string;
}

export const inputsService = {
  async getAll(filters?: InputFilters): Promise<Input[]> {
    const params = new URLSearchParams();
    if (filters?.inputTypeId) params.append('inputTypeId', filters.inputTypeId.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.lowStock) params.append('lowStock', 'true');

    const response = await api.get<Input[]>(`/inputs?${params.toString()}`);
    return response.data || [];
  },

  async getLowStock(): Promise<Input[]> {
    const response = await api.get<Input[]>('/inputs/low-stock');
    return response.data || [];
  },

  async getById(id: number): Promise<Input> {
    const response = await api.get<Input>(`/inputs/${id}`);
    return response.data!;
  },

  async create(data: CreateInputDto): Promise<Input> {
    const response = await api.post<Input>('/inputs', data);
    return response.data!;
  },

  async update(id: number, data: UpdateInputDto): Promise<Input> {
    const response = await api.put<Input>(`/inputs/${id}`, data);
    return response.data!;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/inputs/${id}`);
  },

  async recalculateStock(id: number): Promise<Input> {
    const response = await api.post<Input>(`/inputs/${id}/recalculate-stock`);
    return response.data!;
  },

  // Color management
  async addColor(inputId: number, colorId: number): Promise<Input> {
    const response = await api.post<Input>(`/inputs/${inputId}/colors`, { colorId });
    return response.data!;
  },

  async removeColor(inputId: number, colorId: number): Promise<Input> {
    const response = await api.delete<Input>(`/inputs/${inputId}/colors/${colorId}`);
    return response.data!;
  },

  // Size management
  async addSize(inputId: number, sizeId: number): Promise<Input> {
    const response = await api.post<Input>(`/inputs/${inputId}/sizes`, { sizeId });
    return response.data!;
  },

  async removeSize(inputId: number, sizeId: number): Promise<Input> {
    const response = await api.delete<Input>(`/inputs/${inputId}/sizes/${sizeId}`);
    return response.data!;
  },

  // Variants management
  async getVariants(inputId: number): Promise<InputVariant[]> {
    const response = await api.get<InputVariant[]>(`/inputs/${inputId}/variants`);
    return response.data || [];
  },

  async getVariantById(variantId: number): Promise<InputVariant> {
    const response = await api.get<InputVariant>(`/inputs/variants/${variantId}`);
    return response.data!;
  },

  async updateVariant(variantId: number, data: { unitCost?: number; minStock?: number; maxStock?: number }): Promise<InputVariant> {
    const response = await api.put<InputVariant>(`/inputs/variants/${variantId}`, data);
    return response.data!;
  },

  async updateVariantStock(variantId: number, quantity: number, operation: 'add' | 'subtract'): Promise<InputVariant> {
    const response = await api.post<InputVariant>(`/inputs/variants/${variantId}/stock`, { quantity, operation });
    return response.data!;
  },

  async regenerateVariants(inputId: number): Promise<Input> {
    const response = await api.post<Input>(`/inputs/${inputId}/regenerate-variants`);
    return response.data!;
  },

  async getVariantMovements(variantId: number, limit?: number): Promise<InputVariantMovement[]> {
    const params = limit ? `?limit=${limit}` : '';
    const response = await api.get<InputVariantMovement[]>(`/inputs/variants/${variantId}/movements${params}`);
    return response.data || [];
  },

  // Get all variants from all inputs
  async getAllVariants(): Promise<(InputVariant & { input: { id: number; code: string; name: string; unitOfMeasure: string; isActive: boolean } })[]> {
    return (await http.get<(InputVariant & { input: { id: number; code: string; name: string; unitOfMeasure: string; isActive: boolean } })[]>('/inputs/all-variants')) ?? [];
  },
};
