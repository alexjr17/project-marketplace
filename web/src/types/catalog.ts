// Catálogos de la tienda (tallas, colores, categorías y tipos de producto).
// Es la ÚNICA definición: la usan catalogs.service, CatalogsContext y las pantallas.
// Los ids llegan del API como number.

export interface Size {
  id: number;
  name: string;
  abbreviation: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Color {
  id: number;
  name: string;
  slug: string;
  hexCode: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductType {
  id: number;
  name: string;
  slug: string;
  description?: string;
  categoryId?: number | null;
  categorySlug?: string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Datos para crear un registro de catálogo: el API genera id, slug y fechas. */
export type CatalogInput<T extends { id: number }> = Omit<T, 'id' | 'slug' | 'createdAt' | 'updatedAt'> & { slug?: string };
