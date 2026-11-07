import { http } from '../lib/http';

/** Categoría activa con sus datos para las tarjetas de la portada. */
/** Temática de la tienda (etiqueta de producto) con nº de productos y una foto. */
export interface TagStat {
  tag: string;
  name: string;
  productCount: number;
  image: string | null;
}

export interface CategoryStat {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  productCount: number;
  image: string | null;
}

/** Reseña destacada (aprobada, 4-5 estrellas). El cliente viene como "Nombre I.". */
export interface FeaturedReview {
  id: number;
  rating: number;
  title?: string | null;
  comment: string;
  verifiedPurchase: boolean;
  createdAt: string;
  customerName: string;
  product: { id: number; name: string; image: string | null };
}

/** Lecturas públicas de la portada de la tienda. */
export const storefrontService = {
  /** GET /catalogs/categories/stats: categorías activas con nº de productos e imagen. */
  getCategoryStats: () => http.get<CategoryStat[]>('/catalogs/categories/stats'),

  /** GET /catalogs/tags/stats: temáticas (etiquetas) con más productos. */
  getTagStats: (limit = 12) => http.get<TagStat[]>('/catalogs/tags/stats', { limit }),

  /** GET /reviews/featured: últimas reseñas aprobadas con 4 o 5 estrellas y comentario. */
  getFeaturedReviews: (limit = 6) => http.get<FeaturedReview[]>('/reviews/featured', { limit }),
};

export default storefrontService;
