import api from './api.service';
import type { Product } from '../types/product';

// Helper para normalizar imágenes del producto (soporta hasta 5 imágenes)
function normalizeImages(images: any): { front: string; back?: string; side?: string; extra1?: string; extra2?: string } {
  // Si es null o undefined, retornar objeto vacío con placeholder
  if (!images) {
    return { front: '' };
  }

  // Si es string, intentar parsearlo como JSON
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images);
      return normalizeImages(parsed);
    } catch {
      // Si no es JSON válido, asumir que es una URL de imagen front
      return { front: images };
    }
  }

  // Si es un array, convertir a objeto {front, back, side, extra1, extra2}
  if (Array.isArray(images)) {
    const result: { front: string; back?: string; side?: string; extra1?: string; extra2?: string } = { front: '' };
    images.forEach((img: any, index: number) => {
      if (typeof img === 'string') {
        if (index === 0) result.front = img;
        else if (index === 1) result.back = img;
        else if (index === 2) result.side = img;
        else if (index === 3) result.extra1 = img;
        else if (index === 4) result.extra2 = img;
      } else if (img && typeof img === 'object') {
        // Si es objeto con position o url
        const url = img.url || img.src || img.front || '';
        const position = img.position || img.type || index;
        if (position === 'front' || position === 0) result.front = url;
        else if (position === 'back' || position === 1) result.back = url;
        else if (position === 'side' || position === 2) result.side = url;
        else if (position === 'extra1' || position === 3) result.extra1 = url;
        else if (position === 'extra2' || position === 4) result.extra2 = url;
      }
    });
    return result;
  }

  // Si ya es un objeto, asegurar que tenga la estructura correcta
  if (typeof images === 'object') {
    return {
      front: images.front || images[0] || '',
      back: images.back || images[1] || undefined,
      side: images.side || images[2] || undefined,
      extra1: images.extra1 || images[3] || undefined,
      extra2: images.extra2 || images[4] || undefined,
    };
  }

  return { front: '' };
}

// Helper para normalizar productos del backend
function normalizeProduct(product: any): Product {
  return {
    ...product,
    // Mapear los campos del backend a los del frontend
    category: product.categorySlug || product.category,
    type: product.typeSlug || product.type,
    // Mantener también los campos nuevos
    categorySlug: product.categorySlug,
    typeSlug: product.typeSlug,
    categoryId: product.categoryId,
    typeId: product.typeId,
    // Normalizar imágenes
    images: normalizeImages(product.images),
    // Normalizar colores: hexCode -> hex para compatibilidad con el frontend
    colors: product.colors?.map((c: any) => ({
      ...c,
      hexCode: c.hexCode || c.hex, // Asegurar que hexCode existe
      hex: c.hexCode || c.hex, // Mantener compatibilidad con código existente
    })) || [],
    // Sizes ya vienen en el formato correcto del backend
  };
}

export interface ProductFilters {
  page?: number;
  limit?: number;
  category?: string;
  type?: string;
  featured?: boolean;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  /** Solo productos con descuento automático vigente (lo resuelve el backend). */
  onSale?: boolean;
  /** Temática: etiqueta de los productos (?tag=anime). */
  tag?: string;
  /** La tienda manda isActive=true para que el equipo con sesión no vea inactivos en la portada. */
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ProductsResponse {
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const productsService = {
  /** Pone (o quita, con null) el fondo de la foto en la tienda; el servidor recorta la foto principal. */
  async setBackdrop(id: number, url: string | null): Promise<{ backdrop: import('../types/product').ProductBackdrop | null; warning: string | null }> {
    const r = await api.put<{ backdrop: import('../types/product').ProductBackdrop | null; warning: string | null }>(`/products/${id}/backdrop`, { url });
    return r.data!;
  },
  /** Fondo generado con IA para la foto de un producto. */
  async aiBackdrop(data: { style: string; idea?: string; palette: string[]; designs: string[]; ratio: string }): Promise<{ url: string; concept: string }> {
    const r = await api.post<{ url: string; concept: string }>('/products/backdrop/ai', data);
    return r.data!;
  },
  /** Sube una imagen (data URL) a la carpeta de productos y devuelve su dirección. */
  async uploadImage(dataUrl: string): Promise<string> {
    const r = await api.post<{ url?: string }>('/uploads/base64', { image: dataUrl, folder: 'products' });
    if (!r.data?.url) throw new Error('La imagen no se pudo subir');
    return r.data.url;
  },
  // Obtener todos los productos con filtros
  async getAll(filters?: ProductFilters): Promise<ProductsResponse> {
    const response = await api.get<any[]>('/products', filters);
    return {
      data: (response.data || []).map(normalizeProduct),
      pagination: response.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
  },

  // Obtener producto por ID
  async getById(id: number): Promise<Product | null> {
    try {
      const response = await api.get<any>(`/products/${id}`);
      return response.data ? normalizeProduct(response.data) : null;
    } catch {
      return null;
    }
  },

  // Obtener productos destacados
  async getFeatured(limit = 8): Promise<Product[]> {
    const response = await api.get<any[]>('/products/featured', { limit });
    return (response.data || []).map(normalizeProduct);
  },

  // Buscar productos
  async search(query: string, limit = 20): Promise<Product[]> {
    const response = await api.get<any[]>('/products', { search: query, limit });
    return (response.data || []).map(normalizeProduct);
  },

  // Crear producto (admin)
  async create(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const response = await api.post<any>('/products', product);
    if (!response.data) throw new Error('Error creando producto');
    return normalizeProduct(response.data);
  },

  // Actualizar producto (admin)
  async update(id: number, updates: Partial<Product>): Promise<Product> {
    const response = await api.put<any>(`/products/${id}`, updates);
    if (!response.data) throw new Error('Error actualizando producto');
    return normalizeProduct(response.data);
  },

  // Eliminar producto (admin)
  async delete(id: number): Promise<void> {
    await api.delete(`/products/${id}`);
  },

  // Actualizar stock (admin)
  async updateStock(id: number, quantity: number, operation: 'add' | 'subtract' | 'set'): Promise<Product> {
    const response = await api.patch<any>(`/products/${id}/stock`, { quantity, operation });
    if (!response.data) throw new Error('Error actualizando stock');
    return normalizeProduct(response.data);
  },

  // Obtener categorías desde la tabla categories
  async getCategories(): Promise<Array<{ id: number; name: string; slug: string }>> {
    const response = await api.get<Array<{ id: number; name: string; slug: string }>>('/products/categories');
    return response.data || [];
  },

  // Obtener tipos de producto desde la tabla product_types con su categoría
  async getTypes(): Promise<Array<{ id: number; name: string; slug: string; categoryId: number | null; categorySlug: string | null }>> {
    const response = await api.get<Array<{ id: number; name: string; slug: string; categoryId: number | null; categorySlug: string | null }>>('/products/types');
    return response.data || [];
  },
};

export default productsService;
