import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Loader2 } from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext';
import { productsService } from '../services';
import type { Product } from '../types/product';
import { ProductGrid } from '../components/products/ProductGrid';
import { Seo } from '../components/seo/Seo';

export default function FavoritesPage() {
  const { favorites } = useFavorites();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all(favorites.map((id) => productsService.getById(id).catch(() => null)))
      .then((list) => {
        if (active) setProducts(list.filter((p): p is Product => !!p));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // Recargar cuando cambie la lista de favoritos.
  }, [favorites.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gray-50">
      <Seo title="Favoritos" description="Tus productos guardados." />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
            <Heart className="w-6 h-6 text-red-500 fill-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mis Favoritos</h1>
            <p className="text-gray-600 text-sm">{favorites.length} producto{favorites.length !== 1 ? 's' : ''} guardado{favorites.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {loading && favorites.length > 0 ? (
          <div className="flex justify-center py-24 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : favorites.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <Heart className="w-16 h-16 mx-auto mb-4 text-gray-200" />
            <p className="text-gray-700 font-medium">Aún no tienes favoritos</p>
            <p className="text-sm text-gray-500 mt-1 mb-6">
              Toca el corazón en cualquier producto para guardarlo aquí.
            </p>
            <Link
              to="/catalog"
              className="inline-flex items-center px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
            >
              Explorar productos
            </Link>
          </div>
        ) : (
          <ProductGrid products={products} />
        )}
      </div>
    </div>
  );
}
