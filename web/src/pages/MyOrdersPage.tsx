import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Clock, CheckCircle2, Truck, XCircle, ChevronRight, ShoppingBag, MapPin, CreditCard, AlertCircle, Ban, RefreshCw, FileText, Sparkles, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../context/OrdersContext';
import { usePayments } from '../context/PaymentsContext';
import { ORDER_STATUS_USER_LABELS } from '../types/order';
import type { Order, OrderStatus } from '../types/order';
import type { Payment, PaymentStatus } from '../services/payments.service';
import { PageHeader } from '../components/shared/PageHeader';
import { Seo } from '../components/seo/Seo';
import { Badge, Button, Card, Dialog, EmptyState, SearchInput, SelectInput, Skeleton, Spinner, type Tone } from '../components/ui';

/** Estado del pedido → icono y tono del Badge (tonos con significado del estándar). */
const STATUS_UI: Record<OrderStatus, { icon: React.ReactNode; tone: Tone }> = {
  pending: { icon: <Clock className="w-3 h-3" />, tone: 'yellow' },
  paid: { icon: <CheckCircle2 className="w-3 h-3" />, tone: 'blue' },
  processing: { icon: <Package className="w-3 h-3" />, tone: 'blue' },
  shipped: { icon: <Truck className="w-3 h-3" />, tone: 'blue' },
  delivered: { icon: <CheckCircle2 className="w-3 h-3" />, tone: 'green' },
  cancelled: { icon: <XCircle className="w-3 h-3" />, tone: 'red' },
};

const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { tone: Tone; label: string; icon: React.ReactNode }> = {
  PENDING: { tone: 'yellow', label: 'Pendiente', icon: <Clock className="w-3 h-3" /> },
  PROCESSING: { tone: 'blue', label: 'Procesando', icon: <RefreshCw className="w-3 h-3" /> },
  APPROVED: { tone: 'green', label: 'Aprobado', icon: <CheckCircle2 className="w-3 h-3" /> },
  DECLINED: { tone: 'red', label: 'Rechazado', icon: <XCircle className="w-3 h-3" /> },
  FAILED: { tone: 'red', label: 'Fallido', icon: <AlertCircle className="w-3 h-3" /> },
  CANCELLED: { tone: 'gray', label: 'Cancelado', icon: <Ban className="w-3 h-3" /> },
  EXPIRED: { tone: 'gray', label: 'Expirado', icon: <Clock className="w-3 h-3" /> },
  REFUNDED: { tone: 'blue', label: 'Reembolsado', icon: <RefreshCw className="w-3 h-3" /> },
  PARTIAL_REFUND: { tone: 'blue', label: 'Reembolso parcial', icon: <RefreshCw className="w-3 h-3" /> },
};

/** Etapas visibles del seguimiento (en orden). */
const STAGES: { status: OrderStatus; label: string }[] = [
  { status: 'pending', label: 'Recibido' },
  { status: 'paid', label: 'Confirmado' },
  { status: 'processing', label: 'Preparando' },
  { status: 'shipped', label: 'En camino' },
  { status: 'delivered', label: 'Entregado' },
];

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const ui = STATUS_UI[status];
  return <Badge tone={ui?.tone ?? 'gray'}>{ui?.icon}{ORDER_STATUS_USER_LABELS[status] ?? status}</Badge>;
}

/** Barra de etapas del pedido. */
function OrderProgress({ status }: { status: OrderStatus }) {
  const current = STAGES.findIndex((s) => s.status === status);
  return (
    <div>
      <div className="flex gap-1">
        {STAGES.map((s, i) => (
          <span key={s.status} className={`h-1.5 flex-1 rounded-full ${i <= current ? 'bg-app-600' : 'bg-gray-200'}`} />
        ))}
      </div>
      <div className="mt-1.5 hidden sm:flex justify-between text-[11px] text-gray-400">
        {STAGES.map((s, i) => (
          <span key={s.status} className={i === current ? 'text-app-700 font-medium' : ''}>{s.label}</span>
        ))}
      </div>
    </div>
  );
}

function ItemThumb({ src, alt, size = 'w-12 h-12' }: { src?: string; alt: string; size?: string }) {
  return src ? (
    <img src={src} alt={alt} className={`${size} object-cover rounded-lg border border-gray-200 bg-gray-50 flex-shrink-0`} />
  ) : (
    <div className={`${size} bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center flex-shrink-0`}>
      <Package className="w-5 h-5 text-gray-400" />
    </div>
  );
}

export const MyOrdersPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getMyOrders } = useOrders();
  const { getMyOrderPayments } = usePayments();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderPayments, setOrderPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Cargar pedidos del usuario al montar
  useEffect(() => {
    const loadMyOrders = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const myOrders = await getMyOrders();
        setOrders(myOrders);
      } catch (error) {
        console.error('Error loading orders:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadMyOrders();
  }, [user, getMyOrders]);

  // Cargar pagos cuando se selecciona un pedido
  useEffect(() => {
    const loadPayments = async () => {
      if (!selectedOrder) {
        setOrderPayments([]);
        return;
      }
      setLoadingPayments(true);
      try {
        const payments = await getMyOrderPayments(Number(selectedOrder.id));
        setOrderPayments(payments);
      } catch (error) {
        console.error('Error loading payments:', error);
        setOrderPayments([]);
      } finally {
        setLoadingPayments(false);
      }
    };
    loadPayments();
  }, [selectedOrder, getMyOrderPayments]);

  const header = <PageHeader title="Mis pedidos" subtitle="Historial y seguimiento de tus compras" backLabel="Inicio" backTo="/" />;

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Seo title="Mis pedidos" />
        {header}
        <div className="max-w-5xl mx-auto px-4 py-8">
          <Card padded={false}>
            <EmptyState icon={LogIn} title="Inicia sesión" description="Para ver tus pedidos debes iniciar sesión." />
          </Card>
        </div>
      </div>
    );
  }

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = searchQuery === '' || order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) || order.items.some((item) => item.productName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
  const formatDate = (date: Date) => new Date(date).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-50">
      <Seo title="Mis pedidos" />
      {header}

      <div className="max-w-5xl mx-auto px-4 py-6 lg:py-8 space-y-4">
        {/* Filtros */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col sm:flex-row gap-2">
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Buscar por número de pedido o producto…" className="flex-1" />
          <SelectInput value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')} className="sm:w-48" aria-label="Filtrar por estado">
            <option value="all">Todos los estados</option>
            {Object.entries(ORDER_STATUS_USER_LABELS).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
          </SelectInput>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex justify-between"><Skeleton className="h-4 w-40" /><Skeleton className="h-5 w-20 rounded-full" /></div>
                <Skeleton className="h-1.5 w-full" />
                <div className="flex gap-2"><Skeleton className="h-12 w-12" /><Skeleton className="h-12 w-12" /><Skeleton className="h-4 w-32 self-center" /></div>
              </div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card padded={false}>
            <EmptyState
              icon={Package}
              title={orders.length === 0 ? 'No tienes pedidos aún' : 'No se encontraron pedidos'}
              description={orders.length === 0 ? 'Cuando realices tu primera compra, aparecerá aquí.' : 'Intenta con otros filtros.'}
              action={orders.length === 0 ? <Button icon={<ShoppingBag className="w-4 h-4" />} onClick={() => navigate('/catalog')}>Ver catálogo</Button> : undefined}
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <button
                type="button"
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="w-full text-left bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{order.orderNumber}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDate(order.createdAt)} · {order.items.length} {order.items.length === 1 ? 'producto' : 'productos'}</p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>

                {order.status !== 'cancelled' && <div className="mt-3"><OrderProgress status={order.status} /></div>}

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {order.items.slice(0, 4).map((item) => (
                      <span key={item.id} className="ring-2 ring-white rounded-lg"><ItemThumb src={item.productImage} alt={item.productName} size="w-11 h-11" /></span>
                    ))}
                    {order.items.length > 4 && (
                      <span className="w-11 h-11 ring-2 ring-white bg-gray-100 rounded-lg flex items-center justify-center text-xs font-medium text-gray-600">+{order.items.length - 4}</span>
                    )}
                  </div>
                  <p className="flex-1 min-w-0 text-sm text-gray-600 truncate">
                    {order.items.length === 1 ? order.items[0].productName : order.items.map((i) => i.productName).join(', ')}
                  </p>
                  <div className="text-right flex items-center gap-2">
                    <span className="text-base font-semibold text-gray-900">{formatCurrency(order.total)}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        size="lg"
        title={selectedOrder ? `Pedido ${selectedOrder.orderNumber}` : ''}
        description={selectedOrder ? formatDate(selectedOrder.createdAt) : undefined}
        footer={<Button variant="secondary" onClick={() => setSelectedOrder(null)}>Cerrar</Button>}
      >
        {selectedOrder && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <OrderStatusBadge status={selectedOrder.status} />
            </div>
            {selectedOrder.status !== 'cancelled' && <OrderProgress status={selectedOrder.status} />}

            {/* Productos */}
            <section>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Productos</h4>
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {selectedOrder.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 p-3">
                    <ItemThumb src={item.productImage} alt={item.productName} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                      <p className="text-xs text-gray-500">{[item.size && `Talla ${item.size}`, item.color && `Color ${item.color}`, `Cant. ${item.quantity}`].filter(Boolean).join(' · ')}</p>
                      {item.customization && <Badge tone="app" className="mt-1"><Sparkles className="w-3 h-3" />Personalizado</Badge>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(item.unitPrice * item.quantity)}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(item.unitPrice)} c/u</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Pago */}
              <section className="rounded-lg border border-gray-200 p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4 text-gray-400" />Pago</h4>
                {loadingPayments ? (
                  <Spinner className="py-4" />
                ) : !orderPayments || orderPayments.length === 0 ? (
                  <p className="text-sm text-gray-500">No hay información de pago disponible</p>
                ) : (
                  <div className="space-y-3 divide-y divide-gray-100">
                    {orderPayments.map((payment) => {
                      const statusConfig = PAYMENT_STATUS_CONFIG[payment.status] ?? { tone: 'gray' as Tone, label: payment.status, icon: null };
                      return (
                        <dl key={payment.id} className="space-y-1.5 text-sm pt-3 first:pt-0">
                          <div className="flex items-center justify-between gap-2"><dt className="text-gray-500">Estado</dt><dd><Badge tone={statusConfig.tone}>{statusConfig.icon}{statusConfig.label}</Badge></dd></div>
                          <div className="flex items-center justify-between gap-2"><dt className="text-gray-500">Método</dt><dd className="font-medium text-gray-900 capitalize">{payment.paymentMethod}</dd></div>
                          {payment.transactionId && (
                            <div className="flex items-center justify-between gap-2"><dt className="text-gray-500">Referencia</dt><dd className="font-mono text-xs text-gray-900 truncate">{payment.transactionId}</dd></div>
                          )}
                          {payment.receiptData && <p className="flex items-center gap-1.5 text-green-700"><FileText className="w-4 h-4" />Comprobante subido</p>}
                          {payment.status === 'PENDING' && !payment.receiptData && <p className="flex items-center gap-1.5 text-amber-700"><AlertCircle className="w-4 h-4" />Pendiente de comprobante</p>}
                          {payment.failureReason && <p className="text-red-600"><strong>Razón:</strong> {payment.failureReason}</p>}
                        </dl>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Envío */}
              <section className="rounded-lg border border-gray-200 p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><Truck className="w-4 h-4 text-gray-400" />Envío</h4>
                {selectedOrder.trackingNumber ? (
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-2"><span className="text-gray-500">Número de guía</span><span className="font-mono font-semibold text-gray-900">{selectedOrder.trackingNumber}</span></div>
                    {selectedOrder.trackingUrl && (
                      <a href={selectedOrder.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 w-full h-9 rounded-lg bg-app-600 hover:bg-app-700 text-white text-sm font-medium">
                        <Truck className="w-4 h-4" />Rastrear mi pedido
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    {selectedOrder.status === 'pending' || selectedOrder.status === 'paid' || selectedOrder.status === 'processing'
                      ? 'Tu número de guía estará disponible cuando el pedido sea enviado.'
                      : selectedOrder.status === 'cancelled'
                        ? 'Pedido cancelado: no aplica envío.'
                        : 'No hay información de rastreo disponible.'}
                  </p>
                )}
                <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">
                  <p className="flex items-center gap-1.5 font-medium text-gray-900"><MapPin className="w-4 h-4 text-gray-400" />{selectedOrder.shipping.recipientName}</p>
                  <p className="pl-5">{selectedOrder.shipping.address}</p>
                  <p className="pl-5">{selectedOrder.shipping.city}{selectedOrder.shipping.postalCode && `, ${selectedOrder.shipping.postalCode}`}</p>
                  <p className="pl-5">{selectedOrder.shipping.phone}</p>
                </div>
              </section>
            </div>

            {/* Resumen */}
            <section className="rounded-lg bg-gray-50 p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="text-gray-900">{formatCurrency(selectedOrder.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Envío</span><span className="text-gray-900">{selectedOrder.shippingCost === 0 ? 'Gratis' : formatCurrency(selectedOrder.shippingCost)}</span></div>
              {selectedOrder.discount > 0 && (<div className="flex justify-between text-green-700"><span>Descuento</span><span>-{formatCurrency(selectedOrder.discount)}</span></div>)}
              <div className="flex justify-between pt-2 border-t border-gray-200"><span className="font-semibold text-gray-900">Total</span><span className="text-base font-bold text-gray-900">{formatCurrency(selectedOrder.total)}</span></div>
            </section>
          </div>
        )}
      </Dialog>
    </div>
  );
};
