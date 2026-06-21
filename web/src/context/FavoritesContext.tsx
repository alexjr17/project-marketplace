import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface FavoritesContextType {
  favorites: number[];
  isFavorite: (id: number) => boolean;
  toggleFavorite: (id: number) => void;
  count: number;
}

const STORAGE_KEY = 'marketplace_favorites';
const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

/** Favoritos/Wishlist del cliente, persistidos en localStorage. */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((x) => typeof x === 'number') : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      /* almacenamiento no disponible: ignorar */
    }
  }, [favorites]);

  const isFavorite = (id: number) => favorites.includes(id);

  const toggleFavorite = (id: number) =>
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]));

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, toggleFavorite, count: favorites.length }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error('useFavorites debe usarse dentro de FavoritesProvider');
  }
  return ctx;
}
