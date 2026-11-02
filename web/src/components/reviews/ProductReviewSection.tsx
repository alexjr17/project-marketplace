import { useState, useEffect, useCallback } from 'react';
import { MessageSquarePlus, Loader2, AlertCircle } from 'lucide-react';
import { ReviewSummary } from './ReviewSummary';
import { ReviewList } from './ReviewList';
import { ReviewForm } from './ReviewForm';
import * as reviewsService from '../../services/reviews.service';
import type {
  Review,
  ReviewSummary as ReviewSummaryType,
  ListReviewsParams,
  CreateReviewInput,
  UpdateReviewInput,
  CanReviewResponse,
} from '../../types/review';
import { useAuth } from '../../context/AuthContext';
import toast from '../../lib/toast';
import { useConfirm } from '../ui';

interface ProductReviewSectionProps {
  productId: number;
}

export const ProductReviewSection = ({ productId }: ProductReviewSectionProps) => {
  const { user, isAuthenticated } = useAuth();
  const confirm = useConfirm();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummaryType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Paginación y filtros
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReviews, setTotalReviews] = useState(0);
  const [sortBy, setSortBy] = useState<ListReviewsParams['sortBy']>('newest');
  const [filterRating, setFilterRating] = useState<number | undefined>();

  // Estado del formulario
  const [showForm, setShowForm] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [canReviewData, setCanReviewData] = useState<CanReviewResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  // Cargar reviews
  const loadReviews = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params: ListReviewsParams = {
        page,
        limit: 10,
        sortBy,
        ...(filterRating && { rating: filterRating }),
      };

      const response = await reviewsService.getProductReviews(productId, params);

      setReviews(response.data);
      setSummary(response.summary);
      setTotalPages(response.meta.totalPages);
      setTotalReviews(response.meta.total);
    } catch (err) {
      setError('Error al cargar las reseñas');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [productId, page, sortBy, filterRating]);

  // Verificar si puede dejar review
  const checkCanReview = useCallback(async () => {
    if (!isAuthenticated) {
      setCanReviewData({ canReview: false, reason: 'Inicia sesión para dejar una reseña' });
      return;
    }

    try {
      const data = await reviewsService.canUserReview(productId);
      setCanReviewData(data);
    } catch (err) {
      console.error('Error checking can review:', err);
    }
  }, [productId, isAuthenticated]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    checkCanReview();
  }, [checkCanReview]);

  // Handlers
  const handleSortChange = (newSortBy: ListReviewsParams['sortBy']) => {
    setSortBy(newSortBy);
    setPage(1);
  };

  const handleFilterChange = (rating?: number) => {
    setFilterRating(rating);
    setPage(1);
  };

  const handleSubmitReview = async (data: CreateReviewInput | UpdateReviewInput) => {
    try {
      setIsSubmitting(true);

      if (editingReview) {
        await reviewsService.updateReview(editingReview.id, data as UpdateReviewInput);
        toast.success('Reseña actualizada');
      } else {
        await reviewsService.createReview(data as CreateReviewInput);
        toast.success('Reseña publicada');
      }

      setShowForm(false);
      setEditingReview(null);
      loadReviews();
      checkCanReview();
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar la reseña');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditReview = (review: Review) => {
    setEditingReview(review);
    setShowForm(true);
  };

  const handleDeleteReview = async (reviewId: number) => {
    if (!(await confirm({ title: '¿Eliminar esta reseña?', message: 'No se puede deshacer.', tone: 'danger' }))) return;

    try {
      await reviewsService.deleteReview(reviewId);
      toast.success('Reseña eliminada');
      loadReviews();
      checkCanReview();
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar la reseña');
    }
  };

  const handleVoteHelpful = async (reviewId: number, isHelpful: boolean) => {
    if (!isAuthenticated) {
      toast.error('Inicia sesión para votar');
      return;
    }

    try {
      setIsVoting(true);
      const { helpfulCount } = await reviewsService.voteHelpful(reviewId, isHelpful);

      // Actualizar localmente
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? { ...r, helpfulCount, userVote: isHelpful }
            : r
        )
      );
    } catch (err: any) {
      toast.error(err?.message || 'Error al votar');
    } finally {
      setIsVoting(false);
    }
  };

  const handleRemoveVote = async (reviewId: number) => {
    try {
      setIsVoting(true);
      const { helpfulCount } = await reviewsService.removeVote(reviewId);

      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? { ...r, helpfulCount, userVote: null }
            : r
        )
      );
    } catch (err: any) {
      toast.error(err?.message || 'Error al remover voto');
    } finally {
      setIsVoting(false);
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingReview(null);
  };

  // Mostrar la review existente del usuario si la tiene
  const userExistingReview = canReviewData?.existingReview;

  if (isLoading && reviews.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-app-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-xl p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadReviews}
          className="mt-3 text-sm text-red-600 hover:text-red-700 underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">
          Opiniones de clientes
        </h2>

        {canReviewData?.canReview && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-app-600 text-white text-sm font-medium rounded-lg hover:bg-app-700 transition-colors"
          >
            <MessageSquarePlus className="w-4 h-4" />
            Escribir reseña
          </button>
        )}
      </div>

      {/* Resumen */}
      {summary && summary.totalReviews > 0 && (
        <ReviewSummary summary={summary} />
      )}

      {/* Mensaje si ya dejó review */}
      {userExistingReview && !showForm && (
        <div className="bg-app-50 rounded-xl p-4 border border-app-100">
          <p className="text-sm text-app-700">
            Ya dejaste una reseña para este producto.{' '}
            <button
              onClick={() => handleEditReview(userExistingReview)}
              className="font-medium underline hover:text-app-800"
            >
              Editar reseña
            </button>
          </p>
        </div>
      )}

      {/* Mensaje si no puede dejar review */}
      {!canReviewData?.canReview && !userExistingReview && canReviewData?.reason && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-sm text-gray-600">{canReviewData.reason}</p>
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <ReviewForm
          productId={productId}
          existingReview={editingReview}
          onSubmit={handleSubmitReview}
          onCancel={handleCancelForm}
          isLoading={isSubmitting}
        />
      )}

      {/* Lista de reviews */}
      <ReviewList
        reviews={reviews}
        currentUserId={user?.id}
        totalReviews={totalReviews}
        page={page}
        totalPages={totalPages}
        sortBy={sortBy}
        filterRating={filterRating}
        onSortChange={handleSortChange}
        onFilterChange={handleFilterChange}
        onPageChange={setPage}
        onVoteHelpful={handleVoteHelpful}
        onRemoveVote={handleRemoveVote}
        onEdit={handleEditReview}
        onDelete={handleDeleteReview}
        isVoting={isVoting}
      />
    </div>
  );
};

export default ProductReviewSection;
