import api from './api.service';
import type { Size, Color, Category, ProductType, CatalogInput } from '../types/catalog';

export const catalogsService = {
  // ==================== TALLAS ====================
  async getSizes(): Promise<Size[]> {
    const response = await api.get<Size[]>('/catalogs/sizes');
    return response.data || [];
  },

  async createSize(data: CatalogInput<Size>): Promise<Size> {
    const response = await api.post<Size>('/catalogs/sizes', data);
    if (!response.data) throw new Error('Error creando talla');
    return response.data;
  },

  async updateSize(id: number, data: Partial<Size>): Promise<Size> {
    const response = await api.put<Size>(`/catalogs/sizes/${id}`, data);
    if (!response.data) throw new Error('Error actualizando talla');
    return response.data;
  },

  async deleteSize(id: number): Promise<void> {
    await api.delete(`/catalogs/sizes/${id}`);
  },

  // ==================== COLORES ====================
  async getColors(): Promise<Color[]> {
    const response = await api.get<Color[]>('/catalogs/colors');
    return response.data || [];
  },

  async createColor(data: CatalogInput<Color>): Promise<Color> {
    const response = await api.post<Color>('/catalogs/colors', data);
    if (!response.data) throw new Error('Error creando color');
    return response.data;
  },

  async updateColor(id: number, data: Partial<Color>): Promise<Color> {
    const response = await api.put<Color>(`/catalogs/colors/${id}`, data);
    if (!response.data) throw new Error('Error actualizando color');
    return response.data;
  },

  async deleteColor(id: number): Promise<void> {
    await api.delete(`/catalogs/colors/${id}`);
  },

  // ==================== CATEGORÍAS ====================
  async getCategories(): Promise<Category[]> {
    const response = await api.get<Category[]>('/catalogs/categories');
    return response.data || [];
  },

  async createCategory(data: CatalogInput<Category>): Promise<Category> {
    const response = await api.post<Category>('/catalogs/categories', data);
    if (!response.data) throw new Error('Error creando categoría');
    return response.data;
  },

  async updateCategory(id: number, data: Partial<Category>): Promise<Category> {
    const response = await api.put<Category>(`/catalogs/categories/${id}`, data);
    if (!response.data) throw new Error('Error actualizando categoría');
    return response.data;
  },

  async deleteCategory(id: number): Promise<void> {
    await api.delete(`/catalogs/categories/${id}`);
  },

  // ==================== TIPOS DE PRODUCTO ====================
  async getProductTypes(): Promise<ProductType[]> {
    const response = await api.get<ProductType[]>('/catalogs/product-types');
    return response.data || [];
  },

  async getProductTypeById(id: number): Promise<ProductType> {
    const response = await api.get<ProductType>(`/catalogs/product-types/${id}`);
    if (!response.data) throw new Error('Tipo de producto no encontrado');
    return response.data;
  },

  async createProductType(data: CatalogInput<ProductType>): Promise<ProductType> {
    const response = await api.post<ProductType>('/catalogs/product-types', data);
    if (!response.data) throw new Error('Error creando tipo de producto');
    return response.data;
  },

  async updateProductType(id: number, data: Partial<ProductType>): Promise<ProductType> {
    const response = await api.put<ProductType>(`/catalogs/product-types/${id}`, data);
    if (!response.data) throw new Error('Error actualizando tipo de producto');
    return response.data;
  },

  async deleteProductType(id: number): Promise<void> {
    await api.delete(`/catalogs/product-types/${id}`);
  },

  // ==================== TALLAS POR TIPO DE PRODUCTO ====================
  async getSizesByProductType(productTypeId: number): Promise<Size[]> {
    const response = await api.get<Size[]>(`/catalogs/product-types/${productTypeId}/sizes`);
    return response.data || [];
  },

  async assignSizesToProductType(productTypeId: number, sizeIds: number[]): Promise<Size[]> {
    const response = await api.put<Size[]>(`/catalogs/product-types/${productTypeId}/sizes`, { sizeIds });
    return response.data || [];
  },
};

export default catalogsService;
