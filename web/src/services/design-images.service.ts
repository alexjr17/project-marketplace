import { httpKeepUrls as client } from '../lib/http';
import type { TextShape } from '../lib/textArt';

/** Texto editable de un diseño (ej. el nombre): dónde va (caja en % de la imagen) y con qué letra. */
export interface NamedField {
  key: string;
  label: string;
  default: string;
  maxLength: number;
  box: { x: number; y: number; w: number; h: number };
  style: {
    font: string; weight: number; italic: boolean; color: string; upper: boolean; spacing: number;
    shape: TextShape; curve: number; outline: { color: string; width: number } | null;
  };
}

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
  /** Temporada (navidad…). */
  season?: string | null;
  /** Archivo de producción en el servidor (para componer el nombre en alta calidad). */
  printUrl?: string | null;
  /** Textos editables (si tiene, es un diseño con nombre). */
  textFields?: NamedField[] | null;
  familyId?: number | null;
  /** Rol en la familia (Papá, Mamá, Hijo…). */
  familyRole?: string | null;
}

/** Familia de diseños para el pack familiar. */
export interface DesignFamily {
  id: number;
  name: string;
  description?: string | null;
  season?: string | null;
  sortOrder: number;
  isActive: boolean;
  designs: DesignImage[];
}

export interface DesignImageFilters {
  isActive?: boolean;
  category?: string;
  search?: string;
  season?: string;
  named?: boolean;
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
  season?: string | null;
  printUrl?: string | null;
  textFields?: NamedField[] | null;
  familyId?: number | null;
  familyRole?: string | null;
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
  season?: string | null;
  printUrl?: string | null;
  textFields?: NamedField[] | null;
  familyId?: number | null;
  familyRole?: string | null;
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
  if (filters?.season) params.append('season', filters.season);
  if (filters?.named) params.append('named', '1');

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

async function getSeasons(): Promise<string[]> {
  const r = await client.get<string[]>('/design-images/seasons');
  return Array.isArray(r) ? r : [];
}

// ─── Familias (pack familiar) ───
export interface SaveFamilyInput {
  name?: string; description?: string | null; season?: string | null; sortOrder?: number; isActive?: boolean;
  designs?: { id: number; role?: string | null }[];
}
export const designFamiliesService = {
  /** Tienda: las activas con sus diseños activos. */
  list: async (season?: string) => {
    const r = await client.get<DesignFamily[]>(season ? `/design-families?season=${encodeURIComponent(season)}` : '/design-families');
    return Array.isArray(r) ? r : [];
  },
  /** Admin: todas. */
  adminList: async () => {
    const r = await client.get<DesignFamily[]>('/design-families/admin');
    return Array.isArray(r) ? r : [];
  },
  create: (data: SaveFamilyInput & { name: string }) => client.post<DesignFamily>('/design-families', data),
  update: (id: number, data: SaveFamilyInput) => client.put<DesignFamily>(`/design-families/${id}`, data),
  remove: (id: number) => client.delete(`/design-families/${id}`),
};

export const designImagesService = {
  getAll,
  getById,
  getCategories,
  getSeasons,
  create,
  update,
  remove,
  updateSortOrder,
};
