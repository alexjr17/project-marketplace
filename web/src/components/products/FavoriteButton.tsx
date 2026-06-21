import { Heart } from 'lucide-react';
import { useFavorites } from '../../context/FavoritesContext';

interface FavoriteButtonProps {
  productId: number;
  className?: string;
  size?: number;
}

/** Botón de corazón para agregar/quitar un producto de favoritos. */
export function FavoriteButton({ productId, className = '', size = 18 }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(productId);

  return (
    <button
      type="button"
      aria-label={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      title={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(productId);
      }}
      className={`inline-flex items-center justify-center rounded-full transition-colors ${className}`}
    >
      <Heart
        className={fav ? 'fill-red-500 text-red-500' : 'text-gray-500'}
        style={{ width: size, height: size }}
        strokeWidth={2}
      />
    </button>
  );
}

export default FavoriteButton;
