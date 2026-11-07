import api from './api.service';
import type { QueryParams } from '../lib/http';
import type {
  Review,
  ReviewSummary,
  PaginatedReviews,
  CreateReviewInput,
  UpdateReviewInput,
  CanReviewResponse,
  ListReviewsParams,
} from '../types/review';

// Listar reviews de un producto
export async function getProductReviews(
  productId: number,
  params?: ListReviewsParams
): Promise<PaginatedReviews> {
  const response = await api.get<Review[]>(`/reviews/product/${productId}`, params as QueryParams);
  // La API devuelve { success, data, meta, summary } - extraemos lo necesario
  const apiResponse = response as unknown as { data: Review[]; meta: PaginatedReviews['meta']; summary: ReviewSummary };
  return {
    data: apiResponse.data || [],
    meta: apiResponse.meta || { total: 0, page: 1, limit: 10, totalPages: 0 },
    summary: apiResponse.summary || { averageRating: 0, totalReviews: 0, ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
  };
}

// Verificar si el usuario puede dejar review
export async function canUserReview(productId: number): Promise<CanReviewResponse> {
  const response = await api.get<CanReviewResponse>(`/reviews/can-review/${productId}`);
  return response.data || { canReview: false, reason: 'Error verificando permisos' };
}

// Crear review
export async function createReview(data: CreateReviewInput): Promise<Review> {
  const response = await api.post<Review>('/reviews', data);
  return response.data as Review;
}

// Actualizar mi review
export async function updateReview(id: number, data: UpdateReviewInput): Promise<Review> {
  const response = await api.put<Review>(`/reviews/${id}`, data);
  return response.data as Review;
}

// Eliminar mi review
export async function deleteReview(id: number): Promise<void> {
  await api.delete(`/reviews/${id}`);
}

// Votar útil/no útil
export async function voteHelpful(reviewId: number, isHelpful: boolean): Promise<{ helpfulCount: number }> {
  const response = await api.post<{ helpfulCount: number }>(`/reviews/${reviewId}/vote`, { isHelpful });
  return response.data || { helpfulCount: 0 };
}

// Eliminar voto
export async function removeVote(reviewId: number): Promise<{ helpfulCount: number }> {
  const response = await api.delete<{ helpfulCount: number }>(`/reviews/${reviewId}/vote`);
  return response.data || { helpfulCount: 0 };
}

export default {
  getProductReviews,
  canUserReview,
  createReview,
  updateReview,
  deleteReview,
  voteHelpful,
  removeVote,
};
