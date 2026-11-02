import { useState } from 'react';
import { Star, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { ReviewCard } from './ReviewCard';
import type { Review, ListReviewsParams } from '../../types/review';

interface ReviewListProps {
  reviews: Review[];
  currentUserId?: number;
  totalReviews: number;
  page: number;
  totalPages: number;
  sortBy: ListReviewsParams['sortBy'];
  filterRating?: number;
  onSortChange: (sortBy: ListReviewsParams['sortBy']) => void;
  onFilterChange: (rating?: number) => void;
  onPageChange: (page: number) => void;
  onVoteHelpful: (reviewId: number, isHelpful: boolean) => void;
  onRemoveVote: (reviewId: number) => void;
  onEdit?: (review: Review) => void;
  onDelete?: (reviewId: number) => void;
  isVoting?: boolean;
}

const sortOptions = [
  { value: 'newest', label: 'Más recientes' },
  { value: 'oldest', label: 'Más antiguos' },
  { value: 'highest', label: 'Mejor calificación' },
  { value: 'lowest', label: 'Peor calificación' },
  { value: 'helpful', label: 'Más útiles' },
] as const;

export const ReviewList = ({
  reviews,
  currentUserId,
  totalReviews,
  page,
  totalPages,
  sortBy,
  filterRating,
  onSortChange,
  onFilterChange,
  onPageChange,
  onVoteHelpful,
  onRemoveVote,
  onEdit,
  onDelete,
  isVoting,
}: ReviewListProps) => {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div>
      {/* Filtros y ordenamiento */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-sm text-gray-600">
          {totalReviews} reseña{totalReviews !== 1 ? 's' : ''}
        </p>

        <div className="flex items-center gap-2">
          {/* Filtro por estrellas */}
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                filterRating
                  ? 'bg-app-50 border-app-200 text-app-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {filterRating ? (
                <span className="flex items-center gap-1">
                  {filterRating} <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                </span>
              ) : (
                'Filtrar'
              )}
            </button>

            {showFilters && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowFilters(false)}
                />
                <div className="absolute right-0 top-11 bg-white rounded-lg shadow-lg border border-gray-100 p-3 z-20 min-w-[180px]">
                  <p className="text-xs font-medium text-gray-500 mb-2">Filtrar por calificación</p>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        onFilterChange(undefined);
                        setShowFilters(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm rounded-lg ${
                        !filterRating ? 'bg-app-50 text-app-700' : 'hover:bg-gray-50'
                      }`}
                    >
                      Todas las reseñas
                    </button>
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => {
                          onFilterChange(rating);
                          setShowFilters(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm rounded-lg flex items-center gap-2 ${
                          filterRating === rating
                            ? 'bg-app-50 text-app-700'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {rating}
                        <div className="flex gap-0.5">
                          {Array.from({ length: rating }).map((_, i) => (
                            <Star
                              key={i}
                              className="w-3 h-3 fill-yellow-400 text-yellow-400"
                            />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Ordenamiento */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as ListReviewsParams['sortBy'])}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-app-500 cursor-pointer"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Lista de reviews */}
      {reviews.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {filterRating
              ? `No hay reseñas con ${filterRating} estrellas`
              : 'Aún no hay reseñas para este producto'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              currentUserId={currentUserId}
              onVoteHelpful={onVoteHelpful}
              onRemoveVote={onRemoveVote}
              onEdit={onEdit}
              onDelete={onDelete}
              isVoting={isVoting}
            />
          ))}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-600">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};

export default ReviewList;
