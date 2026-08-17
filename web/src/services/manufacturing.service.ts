import api from './api.service';
import type {
  MfgGarmentType,
  MfgColor,
  MfgSize,
  MfgInput,
  MfgInputType,
  MfgCollection,
  MfgProcess,
  MfgWorkshop,
  MfgWarehouse,
  MfgReference,
  MfgReferenceInput,
  MfgProductionOrder,
  MfgProductionOrderInput,
  MfgStageUpdate,
  MfgOrderStatus,
} from '../types/manufacturing';

/**
 * Servicio de la app "Fábrica" (manufacturing). Usa la instancia `api`
 * compartida (base URL + token + manejo de errores centralizado).
 */
export const manufacturingService = {
  // ==================== TIPOS DE PRENDA ====================
  async getGarmentTypes(): Promise<MfgGarmentType[]> {
    return (await api.get<MfgGarmentType[]>('/manufacturing/garment-types')).data ?? [];
  },
  async createGarmentType(data: Partial<MfgGarmentType> & { nationalSizeIds?: number[]; exportSizeIds?: number[] }): Promise<MfgGarmentType> {
    return (await api.post<MfgGarmentType>('/manufacturing/garment-types', data)).data!;
  },
  async updateGarmentType(id: number, data: Partial<MfgGarmentType> & { nationalSizeIds?: number[]; exportSizeIds?: number[] }): Promise<MfgGarmentType> {
    return (await api.put<MfgGarmentType>(`/manufacturing/garment-types/${id}`, data)).data!;
  },
  async deleteGarmentType(id: number): Promise<void> {
    await api.delete(`/manufacturing/garment-types/${id}`);
  },

  // ==================== COLORES ====================
  async getColors(): Promise<MfgColor[]> {
    return (await api.get<MfgColor[]>('/manufacturing/colors')).data ?? [];
  },
  async createColor(data: Partial<MfgColor>): Promise<MfgColor> {
    return (await api.post<MfgColor>('/manufacturing/colors', data)).data!;
  },
  async updateColor(id: number, data: Partial<MfgColor>): Promise<MfgColor> {
    return (await api.put<MfgColor>(`/manufacturing/colors/${id}`, data)).data!;
  },
  async deleteColor(id: number): Promise<void> {
    await api.delete(`/manufacturing/colors/${id}`);
  },

  // ==================== TALLAS ====================
  async getSizes(): Promise<MfgSize[]> {
    return (await api.get<MfgSize[]>('/manufacturing/sizes')).data ?? [];
  },
  async createSize(data: Partial<MfgSize>): Promise<MfgSize> {
    return (await api.post<MfgSize>('/manufacturing/sizes', data)).data!;
  },
  async updateSize(id: number, data: Partial<MfgSize>): Promise<MfgSize> {
    return (await api.put<MfgSize>(`/manufacturing/sizes/${id}`, data)).data!;
  },
  async deleteSize(id: number): Promise<void> {
    await api.delete(`/manufacturing/sizes/${id}`);
  },

  // ==================== TIPOS DE INSUMO ====================
  async getInputTypes(): Promise<MfgInputType[]> {
    return (await api.get<MfgInputType[]>('/manufacturing/input-types')).data ?? [];
  },
  async createInputType(data: Partial<MfgInputType>): Promise<MfgInputType> {
    return (await api.post<MfgInputType>('/manufacturing/input-types', data)).data!;
  },
  async updateInputType(id: number, data: Partial<MfgInputType>): Promise<MfgInputType> {
    return (await api.put<MfgInputType>(`/manufacturing/input-types/${id}`, data)).data!;
  },
  async deleteInputType(id: number): Promise<void> {
    await api.delete(`/manufacturing/input-types/${id}`);
  },

  // ==================== INSUMOS ====================
  async getInputs(): Promise<MfgInput[]> {
    return (await api.get<MfgInput[]>('/manufacturing/inputs')).data ?? [];
  },
  async createInput(data: Partial<MfgInput>): Promise<MfgInput> {
    return (await api.post<MfgInput>('/manufacturing/inputs', data)).data!;
  },
  async updateInput(id: number, data: Partial<MfgInput>): Promise<MfgInput> {
    return (await api.put<MfgInput>(`/manufacturing/inputs/${id}`, data)).data!;
  },
  async deleteInput(id: number): Promise<void> {
    await api.delete(`/manufacturing/inputs/${id}`);
  },

  // ==================== COLECCIONES ====================
  async getCollections(): Promise<MfgCollection[]> {
    return (await api.get<MfgCollection[]>('/manufacturing/collections')).data ?? [];
  },
  async createCollection(data: Partial<MfgCollection>): Promise<MfgCollection> {
    return (await api.post<MfgCollection>('/manufacturing/collections', data)).data!;
  },
  async updateCollection(id: number, data: Partial<MfgCollection>): Promise<MfgCollection> {
    return (await api.put<MfgCollection>(`/manufacturing/collections/${id}`, data)).data!;
  },
  async deleteCollection(id: number): Promise<void> {
    await api.delete(`/manufacturing/collections/${id}`);
  },

  // ==================== PROCESOS ====================
  async getProcesses(): Promise<MfgProcess[]> {
    return (await api.get<MfgProcess[]>('/manufacturing/processes')).data ?? [];
  },
  async createProcess(data: Partial<Omit<MfgProcess, 'consumptions'>> & { consumptions?: { kind: string; inputTypeId?: number | null; inputId?: number | null }[] }): Promise<MfgProcess> {
    return (await api.post<MfgProcess>('/manufacturing/processes', data)).data!;
  },
  async updateProcess(id: number, data: Partial<Omit<MfgProcess, 'consumptions'>> & { consumptions?: { kind: string; inputTypeId?: number | null; inputId?: number | null }[] }): Promise<MfgProcess> {
    return (await api.put<MfgProcess>(`/manufacturing/processes/${id}`, data)).data!;
  },
  async deleteProcess(id: number): Promise<void> {
    await api.delete(`/manufacturing/processes/${id}`);
  },

  // ==================== TALLERES ====================
  async getWorkshops(): Promise<MfgWorkshop[]> {
    return (await api.get<MfgWorkshop[]>('/manufacturing/workshops')).data ?? [];
  },
  async createWorkshop(data: Partial<MfgWorkshop> & { processIds?: number[] }): Promise<MfgWorkshop> {
    return (await api.post<MfgWorkshop>('/manufacturing/workshops', data)).data!;
  },
  async updateWorkshop(id: number, data: Partial<MfgWorkshop> & { processIds?: number[] }): Promise<MfgWorkshop> {
    return (await api.put<MfgWorkshop>(`/manufacturing/workshops/${id}`, data)).data!;
  },
  async deleteWorkshop(id: number): Promise<void> {
    await api.delete(`/manufacturing/workshops/${id}`);
  },

  // ==================== BODEGAS ====================
  async getWarehouses(): Promise<MfgWarehouse[]> {
    return (await api.get<MfgWarehouse[]>('/manufacturing/warehouses')).data ?? [];
  },
  async createWarehouse(data: Partial<MfgWarehouse>): Promise<MfgWarehouse> {
    return (await api.post<MfgWarehouse>('/manufacturing/warehouses', data)).data!;
  },
  async updateWarehouse(id: number, data: Partial<MfgWarehouse>): Promise<MfgWarehouse> {
    return (await api.put<MfgWarehouse>(`/manufacturing/warehouses/${id}`, data)).data!;
  },
  async deleteWarehouse(id: number): Promise<void> {
    await api.delete(`/manufacturing/warehouses/${id}`);
  },

  // ==================== REFERENCIAS + FICHA TÉCNICA ====================
  async getReferences(search?: string): Promise<MfgReference[]> {
    return (await api.get<MfgReference[]>('/manufacturing/references', search ? { search } : undefined)).data ?? [];
  },
  async getReference(id: number): Promise<MfgReference> {
    return (await api.get<MfgReference>(`/manufacturing/references/${id}`)).data!;
  },
  async generateReferenceCode(garmentTypeId: number): Promise<string> {
    const res = await api.post<{ code: string }>('/manufacturing/references/generate-code', { garmentTypeId });
    return res.data?.code ?? '';
  },
  async createReference(data: MfgReferenceInput): Promise<MfgReference> {
    return (await api.post<MfgReference>('/manufacturing/references', data)).data!;
  },
  async updateReference(id: number, data: MfgReferenceInput): Promise<MfgReference> {
    return (await api.put<MfgReference>(`/manufacturing/references/${id}`, data)).data!;
  },
  async deleteReference(id: number): Promise<void> {
    await api.delete(`/manufacturing/references/${id}`);
  },

  // ==================== ÓRDENES DE PRODUCCIÓN ====================
  async getProductionOrders(params?: { status?: string; search?: string }): Promise<MfgProductionOrder[]> {
    return (await api.get<MfgProductionOrder[]>('/manufacturing/production-orders', params)).data ?? [];
  },
  async getProductionOrder(id: number): Promise<MfgProductionOrder> {
    return (await api.get<MfgProductionOrder>(`/manufacturing/production-orders/${id}`)).data!;
  },
  async generateOrderNumber(): Promise<string> {
    return (await api.get<{ code: string }>('/manufacturing/production-orders/generate-number')).data?.code ?? '';
  },
  async createProductionOrder(data: MfgProductionOrderInput): Promise<MfgProductionOrder> {
    return (await api.post<MfgProductionOrder>('/manufacturing/production-orders', data)).data!;
  },
  async updateProductionOrder(id: number, data: { referenceId?: number; warehouseId?: number | null; collectionId?: number | null; semester?: string | null; internalCode?: string | null; scheduledAt?: string | null; estimatedDeliveryAt?: string | null; notes?: string | null; items?: { colorId: number; sizeId: number; quantity: number }[] }): Promise<MfgProductionOrder> {
    return (await api.put<MfgProductionOrder>(`/manufacturing/production-orders/${id}`, data)).data!;
  },
  async updateStage(id: number, stageId: number, data: MfgStageUpdate): Promise<MfgProductionOrder> {
    return (await api.patch<MfgProductionOrder>(`/manufacturing/production-orders/${id}/stages/${stageId}`, data)).data!;
  },
  /** PDF real (dompdf) del reporte/solicitud de una etapa (o de un componente puntual). */
  async getStagePdf(orderId: number, stageId: number, includeInputs: boolean, componentId?: number): Promise<Blob> {
    return await api.getBlob(`/manufacturing/production-orders/${orderId}/stages/${stageId}/pdf`, { includeInputs: includeInputs ? 1 : 0, componentId });
  },
  async changeOrderStatus(id: number, status: MfgOrderStatus): Promise<MfgProductionOrder> {
    return (await api.patch<MfgProductionOrder>(`/manufacturing/production-orders/${id}/status`, { status })).data!;
  },
  async deleteProductionOrder(id: number): Promise<void> {
    await api.delete(`/manufacturing/production-orders/${id}`);
  },

  // ==================== MATERIALES / SUSTITUCIONES DE LA ORDEN ====================
  async getOrderMaterials(orderId: number): Promise<{ total: number; materials: import('../types/manufacturing').MfgOrderMaterial[] }> {
    return (await api.get<{ total: number; materials: import('../types/manufacturing').MfgOrderMaterial[] }>(`/manufacturing/production-orders/${orderId}/materials`)).data!;
  },
  async saveSubstitution(orderId: number, data: { originalInputId: number; substituteInputId: number; colorId?: number | null }): Promise<import('../types/manufacturing').MfgOrderSubstitution> {
    return (await api.post<import('../types/manufacturing').MfgOrderSubstitution>(`/manufacturing/production-orders/${orderId}/substitutions`, data)).data!;
  },
  async deleteSubstitution(orderId: number, subId: number): Promise<void> {
    await api.delete(`/manufacturing/production-orders/${orderId}/substitutions/${subId}`);
  },

  // ==================== INVENTARIO ====================
  async getInventory(warehouseId?: number): Promise<import('../types/manufacturing').MfgWarehouseStock[]> {
    return (await api.get<import('../types/manufacturing').MfgWarehouseStock[]>('/manufacturing/inventory', warehouseId ? { warehouseId } : undefined)).data ?? [];
  },

  // ==================== CLIENTES ====================
  async getClients(): Promise<import('../types/manufacturing').MfgClient[]> {
    return (await api.get<import('../types/manufacturing').MfgClient[]>('/manufacturing/clients')).data ?? [];
  },
  async createClient(data: Partial<import('../types/manufacturing').MfgClient>): Promise<import('../types/manufacturing').MfgClient> {
    return (await api.post<import('../types/manufacturing').MfgClient>('/manufacturing/clients', data)).data!;
  },
  async updateClient(id: number, data: Partial<import('../types/manufacturing').MfgClient>): Promise<import('../types/manufacturing').MfgClient> {
    return (await api.put<import('../types/manufacturing').MfgClient>(`/manufacturing/clients/${id}`, data)).data!;
  },
  async deleteClient(id: number): Promise<void> {
    await api.delete(`/manufacturing/clients/${id}`);
  },

  // ==================== ÓRDENES DE PEDIDO ====================
  async getPurchaseOrders(params?: { status?: string; search?: string }): Promise<import('../types/manufacturing').MfgPurchaseOrder[]> {
    return (await api.get<import('../types/manufacturing').MfgPurchaseOrder[]>('/manufacturing/purchase-orders', params)).data ?? [];
  },
  async getPurchaseOrder(id: number): Promise<import('../types/manufacturing').MfgPurchaseOrder> {
    return (await api.get<import('../types/manufacturing').MfgPurchaseOrder>(`/manufacturing/purchase-orders/${id}`)).data!;
  },
  async generatePurchaseNumber(): Promise<string> {
    return (await api.get<{ code: string }>('/manufacturing/purchase-orders/generate-number')).data?.code ?? '';
  },
  async createPurchaseOrder(data: import('../types/manufacturing').MfgPurchaseOrderInput): Promise<import('../types/manufacturing').MfgPurchaseOrder> {
    return (await api.post<import('../types/manufacturing').MfgPurchaseOrder>('/manufacturing/purchase-orders', data)).data!;
  },
  async updatePurchaseOrder(id: number, data: import('../types/manufacturing').MfgPurchaseOrderInput): Promise<import('../types/manufacturing').MfgPurchaseOrder> {
    return (await api.put<import('../types/manufacturing').MfgPurchaseOrder>(`/manufacturing/purchase-orders/${id}`, data)).data!;
  },
  async changePurchaseStatus(id: number, status: import('../types/manufacturing').MfgPurchaseStatus): Promise<import('../types/manufacturing').MfgPurchaseOrder> {
    return (await api.patch<import('../types/manufacturing').MfgPurchaseOrder>(`/manufacturing/purchase-orders/${id}/status`, { status })).data!;
  },
  async generateProduction(id: number, referenceIds?: number[]): Promise<{ purchaseOrder: import('../types/manufacturing').MfgPurchaseOrder; created: number }> {
    return (await api.post<{ purchaseOrder: import('../types/manufacturing').MfgPurchaseOrder; created: number }>(`/manufacturing/purchase-orders/${id}/generate-production`, referenceIds ? { referenceIds } : {})).data!;
  },
  async deletePurchaseOrder(id: number): Promise<void> {
    await api.delete(`/manufacturing/purchase-orders/${id}`);
  },

  // ==================== DESPACHOS ====================
  async getDispatches(params?: { status?: string; search?: string }): Promise<import('../types/manufacturing').MfgDispatch[]> {
    return (await api.get<import('../types/manufacturing').MfgDispatch[]>('/manufacturing/dispatches', params)).data ?? [];
  },
  async getDispatch(id: number): Promise<import('../types/manufacturing').MfgDispatch> {
    return (await api.get<import('../types/manufacturing').MfgDispatch>(`/manufacturing/dispatches/${id}`)).data!;
  },
  async getAvailableStock(warehouseId?: number): Promise<import('../types/manufacturing').MfgAvailableStock[]> {
    return (await api.get<import('../types/manufacturing').MfgAvailableStock[]>('/manufacturing/dispatches/available', warehouseId ? { warehouseId } : undefined)).data ?? [];
  },
  async getPoPending(poId: number): Promise<{ purchaseOrder: { id: number; code: string; clientId: number }; items: import('../types/manufacturing').MfgPoPendingItem[] }> {
    return (await api.get<{ purchaseOrder: { id: number; code: string; clientId: number }; items: import('../types/manufacturing').MfgPoPendingItem[] }>(`/manufacturing/dispatches/po/${poId}/pending`)).data!;
  },
  async createDispatch(data: import('../types/manufacturing').MfgDispatchInput): Promise<import('../types/manufacturing').MfgDispatch> {
    return (await api.post<import('../types/manufacturing').MfgDispatch>('/manufacturing/dispatches', data)).data!;
  },
  async confirmDispatch(id: number): Promise<import('../types/manufacturing').MfgDispatch> {
    return (await api.post<import('../types/manufacturing').MfgDispatch>(`/manufacturing/dispatches/${id}/confirm`, {})).data!;
  },
  async cancelDispatch(id: number): Promise<import('../types/manufacturing').MfgDispatch> {
    return (await api.post<import('../types/manufacturing').MfgDispatch>(`/manufacturing/dispatches/${id}/cancel`, {})).data!;
  },
  async deleteDispatch(id: number): Promise<void> {
    await api.delete(`/manufacturing/dispatches/${id}`);
  },
};

export default manufacturingService;
