import { Link } from 'react-router-dom';
import { BadgeCheck, Quote, Star } from 'lucide-react';
import { useStoreData } from '../../hooks/useStoreData';
import { storefrontService, type FeaturedReview } from '../../services/storefront.service';
import { ProductImage } from '../products/ProductImage';
import { Avatar, Skeleton } from '../ui';
import { HomeBlock, SectionHeader } from './SectionHeader';

const dateFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : dateFmt.format(d);
};

/** "Lo que dicen nuestros clientes": reseñas REALES aprobadas (4-5 estrellas). Sin reseñas, no se muestra. */
export function ReviewsSection({ title, subtitle }: { title: string; subtitle?: string }) {
  const { data, loading } = useStoreData<FeaturedReview[]>('reviews:featured', () => storefrontService.getFeaturedReviews(6));
  const reviews = data ?? [];

  if (!loading && reviews.length === 0) return null;

  return (
    <HomeBlock>
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`bg-white rounded-xl border border-gray-200 p-4 space-y-3 ${i > 0 ? 'hidden md:block' : ''}`}>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-10 w-1/2" />
              </div>
            ))
          : reviews.map((r) => (
              <figure key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-w-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex gap-0.5" aria-label={`${r.rating} de 5 estrellas`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}`} />
                    ))}
                  </div>
                  <Quote className="w-5 h-5 text-app-200" />
                </div>
                {r.title && <p className="font-semibold text-gray-900 text-sm mb-1">{r.title}</p>}
                <blockquote className="text-sm text-gray-700 leading-relaxed line-clamp-4 flex-1">“{r.comment}”</blockquote>

                <figcaption className="mt-4 flex items-center gap-3 min-w-0">
                  <Avatar name={r.customerName} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-1">
                      {r.customerName}
                      {r.verifiedPurchase && (
                        <span title="Compra verificada" className="inline-flex text-green-600"><BadgeCheck className="w-4 h-4" /></span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{fmtDate(r.createdAt)}</p>
                  </div>
                  <Link to={`/product/${r.product.id}`} title={r.product.name} className="flex items-center gap-2 min-w-0 max-w-[45%] rounded-lg hover:bg-gray-50 p-1 -m-1">
                    <span className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      <ProductImage src={r.product.image} alt={r.product.name} width={80} iconClassName="w-4 h-4" />
                    </span>
                    <span className="text-xs text-gray-600 truncate hidden sm:inline">{r.product.name}</span>
                  </Link>
                </figcaption>
              </figure>
            ))}
      </div>
    </HomeBlock>
  );
}
