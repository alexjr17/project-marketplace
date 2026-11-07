import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { Button, EmptyState, Skeleton } from '../components/ui';
import { useFavorites } from '../context/FavoritesContext';
import { productsService } from '../services';
import type { Product } from '../types/product';
import { ProductGrid } from '../components/products/ProductGrid';
import { Seo } from '../components/seo/Seo';
import { AccountLayout } from '../components/profile/AccountLayout';

export default function FavoritesPage() {
  const { favorites } = useFavorites();
  const navigate = useNavigate();
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
      <PageHeader
        title="Mis favoritos"
        subtitle={`${favorites.length} producto${favorites.length !== 1 ? 's' : ''} guardado${favorites.length !== 1 ? 's' : ''}`}
        backLabel="Inicio"
        backTo="/"
      />

      <AccountLayout>
        {loading && favorites.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {favorites.slice(0, 8).map((id) => (
              <div key={id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <Skeleton className="aspect-square w-full rounded-none" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200">
            <EmptyState
              icon={Heart}
              title="Aún no tienes favoritos"
              description="Toca el corazón en cualquier producto para guardarlo aquí."
              action={<Button onClick={() => navigate('/catalog')}>Explorar productos</Button>}
            />
          </div>
        ) : (
          <ProductGrid products={products} />
        )}
      </AccountLayout>
    </div>
  );
}
