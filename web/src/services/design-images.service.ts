import { httpKeepUrls as client } from '../lib/http';
export interface DesignImage {
  id: number;
  name: string;
  description?: string;
  thumbnailUrl: string;
  fullUrl: string;
  category?: string;
  tags?: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DesignImageFilters {
  isActive?: boolean;
  category?: string;
  search?: string;
}

export interface CreateDesignImageInput {
  name: string;
  description?: string;
  thumbnailUrl: string;
  fullUrl: string;
  category?: string;
  tags?: string[];
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateDesignImageInput {
  name?: string;
  description?: string;
  thumbnailUrl?: string;
  fullUrl?: string;
  category?: string;
  tags?: string[];
  sortOrder?: number;
  isActive?: boolean;
}

// Listar todas las imágenes de diseño
async function getAll(filters?: DesignImageFilters): Promise<DesignImage[]> {
  const params = new URLSearchParams();

  if (filters?.isActive !== undefined) {
    params.append('isActive', String(filters.isActive));
  }
  if (filters?.category) {
    params.append('category', filters.category);
  }
  if (filters?.search) {
    params.append('search', filters.search);
  }

  const queryString = params.toString();
  const result = await client.get<DesignImage[]>(queryString ? `/design-images?${queryString}` : '/design-images');
  return Array.isArray(result) ? result : [];
}

// Obtener imagen por ID
async function getById(id: number): Promise<DesignImage> {
  return client.get<DesignImage>(`/design-images/${id}`);
}

// Obtener categorías únicas
async function getCategories(): Promise<string[]> {
  return client.get<string[]>(`/design-images/categories`);
}

// Crear imagen de diseño
async function create(data: CreateDesignImageInput): Promise<DesignImage> {
  return client.post<DesignImage>(`/design-images`, data);
}

// Actualizar imagen de diseño
async function update(id: number, data: UpdateDesignImageInput): Promise<DesignImage> {
  return client.put<DesignImage>(`/design-images/${id}`, data);
}

// Eliminar imagen de diseño (soft delete)
async function remove(id: number, permanent = false): Promise<void> {
  await client.delete(`/design-images/${id}${permanent ? '?permanent=true' : ''}`);
}

// Actualizar orden de múltiples imágenes
async function updateSortOrder(items: { id: number; sortOrder: number }[]): Promise<void> {
  await client.put(`/design-images/sort-order`, { items });
}

export const designImagesService = {
  getAll,
  getById,
  getCategories,
  create,
  update,
  remove,
  updateSortOrder,
};
