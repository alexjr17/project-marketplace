import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, MessageSquare, Star, ThumbsUp } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api.service';
import {
  Page, PageHeader, StatCard, FilterBar, SearchInput, Field, SelectInput, Avatar,
  TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage, Badge, Pager, type Tone,
} from '../../components/ui';

interface ReviewUser { id: number; name: string; email: string }
interface ReviewProduct { id: number; name: string }

interface AdminReview {
  id: number;
  userId: number;
  productId: number;
  rating: number;
  title: string | null;
  comment: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
  user: ReviewUser;
  product: ReviewProduct;
}

interface ReviewStats { totalReviews: number; averageRating: number; pendingReviews: number; verifiedPurchases: number }

const STATUS: Record<AdminReview['status'], { label: string; tone: Tone }> = {
  PENDING: { label: 'Pendiente', tone: 'yellow' },
  APPROVED: { label: 'Aprobada', tone: 'green' },
  REJECTED: { label: 'Rechazada', tone: 'red' },
};

const Stars = ({ value }: { value: number }) => (
  <span className="inline-flex items-center gap-0.5" title={`${value} de 5`}>
    {Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} className={`w-3.5 h-3.5 ${i < value ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}`} />
    ))}
  </span>
);

/** Reseñas que los clientes dejan en los productos. */
export default function ReviewsPage() {
  const { showToast } = useToast();
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [ratingFilter, setRatingFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadData();
  }, [statusFilter, ratingFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (ratingFilter) params.rating = ratingFilter;

      const response = await api.get('/reviews/admin/all', params);
      const reviewsData: AdminReview[] = (response as any).data || [];
      setReviews(reviewsData);
      setPage(1);

      const total = reviewsData.length;
      setStats({
        totalReviews: total,
        averageRating: total > 0 ? reviewsData.reduce((acc, r) => acc + r.rating, 0) / total : 0,
        pendingReviews: reviewsData.filter((r) => r.status === 'PENDING').length,
        verifiedPurchases: reviewsData.filter((r) => r.verifiedPurchase).length,
      });
    } catch (error) {
      console.error('Error loading reviews:', error);
      showToast('Error al cargar reseñas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return reviews;
    const term = searchTerm.toLowerCase();
    return reviews.filter((r) =>
      r.product?.name?.toLowerCase().includes(term) ||
      r.user?.name?.toLowerCase().includes(term) ||
      r.user?.email?.toLowerCase().includes(term) ||
      r.comment?.toLowerCase().includes(term) ||
      r.title?.toLowerCase().includes(term));
  }, [reviews, searchTerm]);

  const visible = filteredData.slice((page - 1) * pageSize, page * pageSize);
  const filtered = !!(searchTerm || statusFilter || ratingFilter);

  return (
    <Page>
      <PageHeader icon={Star} title="Reseñas" subtitle="Valoraciones de los clientes sobre los productos" />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={MessageSquare} label="Reseñas" value={stats.totalReviews} hint={filtered ? 'Según los filtros' : undefined} />
          <StatCard icon={Star} tone="yellow" label="Promedio" value={stats.averageRating.toFixed(1).replace('.', ',')} hint="de 5 estrellas" />
          <StatCard icon={Clock} tone={stats.pendingReviews > 0 ? 'yellow' : 'gray'} label="Pendientes" value={stats.pendingReviews} />
          <StatCard icon={CheckCircle} tone="green" label="Compra verificada" value={stats.verifiedPurchases} />
        </div>
      )}

      <FilterBar>
        <div className="sm:col-span-2"><SearchInput value={searchTerm} onChange={(v) => { setSearchTerm(v); setPage(1); }} placeholder="Buscar por producto, cliente o comentario…" /></div>
        <Field>
          <SelectInput aria-label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="PENDING">Pendiente</option>
            <option value="APPROVED">Aprobada</option>
            <option value="REJECTED">Rechazada</option>
          </SelectInput>
        </Field>
        <Field>
          <SelectInput aria-label="Calificación" value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)}>
            <option value="">Todas las calificaciones</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'estrella' : 'estrellas'}</option>)}
          </SelectInput>
        </Field>
      </FilterBar>

      <TableCard footer={filteredData.length > 0 && <Pager page={page} pageSize={pageSize} total={filteredData.length} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} />}>
        <Table>
          <THead>
            <tr>
              <Th>Producto</Th><Th>Cliente</Th><Th>Calificación</Th><Th>Comentario</Th>
              <Th align="right">Útil</Th><Th align="center">Estado</Th><Th>Fecha</Th>
            </tr>
          </THead>
          <TBody>
            {loading ? <TableMessage colSpan={7}>Cargando reseñas…</TableMessage>
              : visible.length === 0 ? <TableMessage colSpan={7}>{filtered ? 'Ninguna reseña coincide con los filtros.' : 'Aún no hay reseñas.'}</TableMessage>
                : visible.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <span className="font-medium text-gray-900">{r.product?.name || '—'}</span>
                      <span className="block text-xs text-gray-400">ID {r.productId}</span>
                    </Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        <Avatar name={r.user?.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block text-gray-900 truncate">{r.user?.name || '—'}</span>
                          <span className="block text-xs text-gray-500 truncate">{r.user?.email}</span>
                        </span>
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <Stars value={r.rating} />
                      {r.verifiedPurchase && <span className="mt-1 flex items-center gap-1 text-xs text-green-700"><CheckCircle className="w-3 h-3" />Compra verificada</span>}
                    </Td>
                    <Td className="max-w-xs">
                      {r.title && <span className="block font-medium text-gray-900 truncate">{r.title}</span>}
                      <span className="block text-gray-600 line-clamp-2">{r.comment}</span>
                    </Td>
                    <Td align="right"><span className="inline-flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5 text-gray-400" />{r.helpfulCount}</span></Td>
                    <Td align="center"><Badge tone={STATUS[r.status]?.tone ?? 'gray'}>{STATUS[r.status]?.label ?? r.status}</Badge></Td>
                    <Td className="whitespace-nowrap text-gray-500">{new Date(r.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</Td>
                  </Tr>
                ))}
          </TBody>
        </Table>
      </TableCard>
    </Page>
  );
}
