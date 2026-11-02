import { useState } from 'react';
import { ThumbsUp, ThumbsDown, MoreVertical, Edit2, Trash2, CheckCircle } from 'lucide-react';
import { RatingStars } from './RatingStars';
import type { Review } from '../../types/review';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface ReviewCardProps {
  review: Review;
  currentUserId?: number;
  onVoteHelpful?: (reviewId: number, isHelpful: boolean) => void;
  onRemoveVote?: (reviewId: number) => void;
  onEdit?: (review: Review) => void;
  onDelete?: (reviewId: number) => void;
  isVoting?: boolean;
}

export const ReviewCard = ({
  review,
  currentUserId,
  onVoteHelpful,
  onRemoveVote,
  onEdit,
  onDelete,
  isVoting = false,
}: ReviewCardProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const isOwner = currentUserId && review.userId === currentUserId;

  const handleVote = (isHelpful: boolean) => {
    if (!onVoteHelpful || isOwner) return;

    // Si ya votó igual, remover voto
    if (review.userVote === isHelpful) {
      onRemoveVote?.(review.id);
    } else {
      onVoteHelpful(review.id, isHelpful);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(review.createdAt), {
    addSuffix: true,
    locale: es,
  });

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 hover:border-gray-200 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          {review.user.avatar ? (
            <img
              src={review.user.avatar}
              alt={review.user.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-app-100 flex items-center justify-center text-app-700 font-semibold">
              {review.user.name.charAt(0).toUpperCase()}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{review.user.name}</span>
              {review.verifiedPurchase && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <CheckCircle className="w-3 h-3" />
                  Compra verificada
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <RatingStars rating={review.rating} size="sm" />
              <span className="text-xs text-gray-400">{timeAgo}</span>
            </div>
          </div>
        </div>

        {/* Menu for owner */}
        {isOwner && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20 min-w-[140px]">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit?.(review);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete?.(review.id);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Title */}
      {review.title && (
        <h4 className="font-semibold text-gray-900 mb-2">{review.title}</h4>
      )}

      {/* Comment */}
      <p className="text-gray-700 text-sm leading-relaxed mb-4">{review.comment}</p>

      {/* Footer - Helpful votes */}
      <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-500">¿Te resultó útil?</span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleVote(true)}
            disabled={isVoting || isOwner}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              review.userVote === true
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } ${isOwner ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <ThumbsUp className="w-4 h-4" />
            <span>{review.helpfulCount}</span>
          </button>

          <button
            onClick={() => handleVote(false)}
            disabled={isVoting || isOwner}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              review.userVote === false
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } ${isOwner ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <ThumbsDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewCard;
