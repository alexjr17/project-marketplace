import { useState, useEffect } from 'react';
import { Star, Loader2, CheckCircle } from 'lucide-react';
import type { CreateReviewInput, UpdateReviewInput, Review } from '../../types/review';

interface ReviewFormProps {
  productId?: number;
  existingReview?: Review | null;
  onSubmit: (data: CreateReviewInput | UpdateReviewInput) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export const ReviewForm = ({
  productId,
  existingReview,
  onSubmit,
  onCancel,
  isLoading = false,
}: ReviewFormProps) => {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState(existingReview?.title || '');
  const [comment, setComment] = useState(existingReview?.comment || '');
  const [errors, setErrors] = useState<{ rating?: string; comment?: string }>({});

  const isEditing = !!existingReview;

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating);
      setTitle(existingReview.title || '');
      setComment(existingReview.comment);
    }
  }, [existingReview]);

  const validate = (): boolean => {
    const newErrors: { rating?: string; comment?: string } = {};

    if (rating === 0) {
      newErrors.rating = 'Selecciona una calificación';
    }

    if (comment.length < 10) {
      newErrors.comment = 'El comentario debe tener al menos 10 caracteres';
    }

    if (comment.length > 2000) {
      newErrors.comment = 'El comentario no puede exceder 2000 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const data = isEditing
      ? {
          rating,
          title: title || null,
          comment,
        } as UpdateReviewInput
      : {
          productId: productId!,
          rating,
          title: title || undefined,
          comment,
        } as CreateReviewInput;

    await onSubmit(data);
  };

  const ratingLabels = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl p-5 border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle className="w-5 h-5 text-green-500" />
        <span className="text-sm text-gray-600">Compra verificada</span>
      </div>

      {/* Rating */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tu calificación *
        </label>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1 hover:scale-110 transition-transform focus:outline-none"
              >
                <Star
                  className={`w-8 h-8 ${
                    star <= (hoverRating || rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'fill-gray-200 text-gray-200'
                  }`}
                />
              </button>
            ))}
          </div>
          {(hoverRating || rating) > 0 && (
            <span className="text-sm font-medium text-gray-600">
              {ratingLabels[hoverRating || rating]}
            </span>
          )}
        </div>
        {errors.rating && (
          <p className="mt-1 text-sm text-red-500">{errors.rating}</p>
        )}
      </div>

      {/* Title */}
      <div className="mb-4">
        <label htmlFor="review-title" className="block text-sm font-medium text-gray-700 mb-1.5">
          Título (opcional)
        </label>
        <input
          id="review-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Resume tu experiencia en una frase"
          maxLength={200}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-app-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Comment */}
      <div className="mb-5">
        <label htmlFor="review-comment" className="block text-sm font-medium text-gray-700 mb-1.5">
          Tu opinión *
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Cuéntanos qué te pareció el producto, la calidad, el material, etc."
          rows={4}
          maxLength={2000}
          className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-app-500 focus:border-transparent text-sm resize-none ${
            errors.comment ? 'border-red-300' : 'border-gray-200'
          }`}
        />
        <div className="flex justify-between mt-1">
          {errors.comment && (
            <p className="text-sm text-red-500">{errors.comment}</p>
          )}
          <p className={`text-xs ml-auto ${comment.length > 1800 ? 'text-amber-600' : 'text-gray-400'}`}>
            {comment.length}/2000
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading || rating === 0}
          className="px-5 py-2 bg-app-600 text-white text-sm font-medium rounded-lg hover:bg-app-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEditing ? 'Actualizar reseña' : 'Publicar reseña'}
        </button>
      </div>
    </form>
  );
};

export default ReviewForm;
