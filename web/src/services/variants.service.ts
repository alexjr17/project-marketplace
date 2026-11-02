import { httpKeepUrls as client, isApiError, type Paged } from '../lib/http';
// ==================== TIPOS ====================

export interface ProductVariant {
  id: number;
  productId: number;
  colorId: number | null;
  sizeId: number | null;
  sku: string;
  barcode: string | null;
  stock: number;
  minStock: number;
  priceAdjustment: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  product: {
    id: number;
    name: string;
    sku: string;
    basePrice: number;
    images: string[];
    isTemplate: boolean;
  };
  color: {
    id: number;
    name: string;
    hexCode: string;
    slug: string;
  } | null;
  size: {
    id: number;
    name: string;
    abbreviation: string;
  } | null;
  finalPrice: number;
}

export interface CreateVariantInput {
  productId: number;
  colorId?: number | null;
  sizeId?: number | null;
  sku?: string;
  barcode?: string;
  stock?: number;
  minStock?: number;
  priceAdjustment?: number;
}

export interface UpdateVariantInput {
  sku?: string;
  barcode?: string;
  stock?: number;
  minStock?: number;
  priceAdjustment?: number;
  isActive?: boolean;
}

export interface VariantFilter {
  productId?: number;
  colorId?: number;
  sizeId?: number;
  isActive?: boolean;
  lowStock?: boolean;
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ==================== API ====================

/**
 * Listar variantes con filtros
 */
export async function getVariants(filter: VariantFilter = {}): Promise<ProductVariant[]> {
  const params = new URLSearchParams();

  if (filter.productId) params.append('productId', filter.productId.toString());
  if (filter.colorId) params.append('colorId', filter.colorId.toString());
  if (filter.sizeId) params.append('sizeId', filter.sizeId.toString());
  if (filter.isActive !== undefined) params.append('isActive', filter.isActive.toString());
  if (filter.lowStock) params.append('lowStock', 'true');

  return client.get<ProductVariant[]>(`/variants?${params.toString()}`);
}

/**
 * Obtener una variante por ID
 */
export async function getVariantById(id: number): Promise<ProductVariant> {
  return client.get<ProductVariant>(`/variants/${id}`);
}

/**
 * Buscar variante por código de barras
 */
export async function getVariantByBarcode(barcode: string): Promise<ProductVariant | null> {
  try {
    return await client.get<ProductVariant | null>(`/variants/barcode/${barcode}`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Buscar variante por SKU
 */
export async function getVariantBySku(sku: string): Promise<ProductVariant | null> {
  try {
    return await client.get<ProductVariant | null>(`/variants/sku/${sku}`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Crear una variante manualmente
 */
export async function createVariant(data: CreateVariantInput): Promise<ProductVariant> {
  return client.post<ProductVariant>(`/variants`, data);
}

/**
 * Actualizar una variante
 */
export async function updateVariant(id: number, data: UpdateVariantInput): Promise<ProductVariant> {
  return client.patch<ProductVariant>(`/variants/${id}`, data);
}

/**
 * Eliminar una variante
 */
export async function deleteVariant(id: number): Promise<void> {
  await client.delete(`/variants/${id}`);
}

/**
 * Generar variantes automáticamente para un producto
 */
export async function generateVariantsForProduct(
  productId: number,
  initialStock: number = 0
): Promise<{ created: ProductVariant[]; errors: any[]; total: number }> {
  return client.post<{ created: ProductVariant[]; errors: any[]; total: number }>(`/variants/generate/${productId}`, { initialStock });
}

/**
 * Ajustar stock de una variante
 */
export async function adjustStock(
  id: number,
  quantity: number,
  reason?: string
): Promise<ProductVariant> {
  return client.post<ProductVariant>(`/variants/${id}/adjust-stock`, { quantity, reason });
}

/**
 * Obtener variantes con stock bajo
 */
export async function getLowStockVariants(): Promise<ProductVariant[]> {
  return client.get<ProductVariant[]>(`/variants/low-stock`);
}

const toPaginatedResult = <T,>({ items, page, limit, total, totalPages }: Paged<T>): PaginatedResult<T> => ({
  data: items,
  pagination: { page, limit, total, totalPages },
});

/**
 * Obtener solo variantes de PRODUCTOS (no templates) - con paginación del servidor
 */
export async function getProductVariants(filter: VariantFilter = {}): Promise<PaginatedResult<ProductVariant>> {
  const params = new URLSearchParams();

  if (filter.productId) params.append('productId', filter.productId.toString());
  if (filter.colorId) params.append('colorId', filter.colorId.toString());
  if (filter.sizeId) params.append('sizeId', filter.sizeId.toString());
  if (filter.isActive !== undefined) params.append('isActive', filter.isActive.toString());
  if (filter.lowStock) params.append('lowStock', 'true');
  if (filter.page) params.append('page', filter.page.toString());
  if (filter.limit) params.append('limit', filter.limit.toString());
  if (filter.search) params.append('search', filter.search);

  return toPaginatedResult(await client.getPaged<ProductVariant>(`/variants/products?${params.toString()}`));
}

/**
 * Obtener solo variantes de TEMPLATES (plantillas) - con paginación y stock calculado desde insumos
 */
export async function getTemplateVariants(filter: VariantFilter = {}): Promise<PaginatedResult<ProductVariant>> {
  const params = new URLSearchParams();

  if (filter.productId) params.append('productId', filter.productId.toString());
  if (filter.colorId) params.append('colorId', filter.colorId.toString());
  if (filter.sizeId) params.append('sizeId', filter.sizeId.toString());
  if (filter.isActive !== undefined) params.append('isActive', filter.isActive.toString());
  if (filter.lowStock) params.append('lowStock', 'true');
  if (filter.page) params.append('page', filter.page.toString());
  if (filter.limit) params.append('limit', filter.limit.toString());
  if (filter.search) params.append('search', filter.search);

  return toPaginatedResult(await client.getPaged<ProductVariant>(`/variants/templates?${params.toString()}`));
}

/**
 * Buscar variante por productId, colorHex y sizeName
 * Útil para verificar stock desde el carrito
 */
export async function getVariantByProductColorSize(
  productId: number,
  colorHex: string,
  sizeName: string
): Promise<ProductVariant | null> {
  try {
    const params = new URLSearchParams({
      productId: productId.toString(),
      colorHex,
      sizeName,
    });

    return await client.get<ProductVariant | null>(`/variants/lookup?${params.toString()}`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }
    throw error;
  }
}
