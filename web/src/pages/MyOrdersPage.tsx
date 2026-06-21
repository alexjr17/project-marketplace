import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, Clock, CheckCircle2, Truck, XCircle, ChevronRight, ShoppingBag, Search, Filter, Eye, MapPin, Calendar, CreditCard, Loader2, AlertCircle, Ban, RefreshCw, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../context/OrdersContext';
import { usePayments } from '../context/PaymentsContext';
import { ORDER_STATUS_USER_LABELS, ORDER_STATUS_COLORS } from '../types/order';
import type { Order, OrderStatus } from '../types/order';
import type { Payment, PaymentStatus } from '../services/payments.service';

const STATUS_ICONS: Record<OrderStatus, React.ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  paid: <CheckCircle2 className="w-4 h-4" />,
  processing: <Package className="w-4 h-4" />,
  shipped: <Truck className="w-4 h-4" />,
  delivered: <CheckCircle2 className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />,
};

const PAYMENT_STATUS_CONFIG: Record<
  PaymentStatus,
  { color: string; bg: string; label: string; icon: React.ReactNode }
> = {
  PENDING: {
    color: 'text-yellow-700',
    bg: 'bg-yellow-100',
    label: 'Pendiente',
    icon: <Clock className="w-4 h-4" />,
  },
  PROCESSING: {
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    label: 'Procesando',
    icon: <RefreshCw className="w-4 h-4" />,
  },
  APPROVED: {
    color: 'text-green-700',
    bg: 'bg-green-100',
    label: 'Aprobado',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  DECLINED: {
    color: 'text-red-700',
    bg: 'bg-red-100',
    label: 'Rechazado',
    icon: <XCircle className="w-4 h-4" />,
  },
  FAILED: {
    color: 'text-red-700',
    bg: 'bg-red-100',
    label: 'Fallido',
    icon: <AlertCircle className="w-4 h-4" />,
  },
  CANCELLED: {
    color: 'text-gray-700',
    bg: 'bg-gray-100',
    label: 'Cancelado',
    icon: <Ban className="w-4 h-4" />,
  },
  EXPIRED: {
    color: 'text-orange-700',
    bg: 'bg-orange-100',
    label: 'Expirado',
    icon: <Clock className="w-4 h-4" />,
  },
  REFUNDED: {
    color: 'text-purple-700',
    bg: 'bg-purple-100',
    label: 'Reembolsado',
    icon: <RefreshCw className="w-4 h-4" />,
  },
  PARTIAL_REFUND: {
    color: 'text-purple-700',
    bg: 'bg-purple-100',
    label: 'Reembolso Parcial',
    icon: <RefreshCw className="w-4 h-4" />,
  },
};

export const MyOrdersPage = () => {
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <ShoppingBag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Inicia sesion</h2>
          <p className="text-gray-600">Para ver tus pedidos debes iniciar sesion</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-violet-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Cargando tus pedidos...</p>
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
  const getStatusProgress = (status: OrderStatus): number => ({ pending: 20, paid: 40, processing: 60, shipped: 80, delivered: 100, cancelled: 0 })[status];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Mis Pedidos</h1>
          <p className="text-gray-600 mt-2">Historial y seguimiento de tus compras</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" placeholder="Buscar por numero de pedido..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent" />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')} className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 appearance-none bg-white">
                <option value="all">Todos</option>
                {Object.entries(ORDER_STATUS_USER_LABELS).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
              </select>
            </div>
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{orders.length === 0 ? 'No tienes pedidos aun' : 'No se encontraron pedidos'}</h3>
            <p className="text-gray-600 mb-6">{orders.length === 0 ? 'Cuando realices tu primera compra, aparecera aqui' : 'Intenta con otros filtros'}</p>
            {orders.length === 0 && (<Link to="/catalog" className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700"><ShoppingBag className="w-5 h-5" />Ver Catalogo</Link>)}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-4 border-b border-gray-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center"><Package className="w-5 h-5 text-gray-600" /></div>
                      <div>
                        <p className="font-bold text-gray-900">{order.orderNumber}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(order.createdAt)}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${ORDER_STATUS_COLORS[order.status]}`}>{STATUS_ICONS[order.status]}{ORDER_STATUS_USER_LABELS[order.status]}</span>
                  </div>
                </div>
                {order.status !== 'cancelled' && (
                  <div className="px-4 py-3 bg-gray-50">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2"><span>Recibido</span><span>Confirmado</span><span>Preparando</span><span>En camino</span><span>Entregado</span></div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-gray-600 rounded-full" style={{ width: `${getStatusProgress(order.status)}%` }} /></div>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center gap-4 overflow-x-auto pb-2">
                    {order.items.slice(0, 4).map((item) => (
                      item.productImage ? (
                        <img key={item.id} src={item.productImage} alt={item.productName} className="w-16 h-16 object-cover rounded-lg border border-gray-200 flex-shrink-0" />
                      ) : (
                        <div key={item.id} className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-8 h-8 text-gray-400" />
                        </div>
                      )
                    ))}
                    {order.items.length > 4 && (<div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0"><span className="text-sm font-medium text-gray-600">+{order.items.length - 4}</span></div>)}
                    <div className="flex-1 min-w-0 pl-2">
                      <p className="text-sm text-gray-600 truncate">{order.items.length === 1 ? order.items[0].productName : `${order.items.length} productos`}</p>
                      <p className="font-bold text-gray-900">{formatCurrency(order.total)}</p>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
                  <button onClick={() => setSelectedOrder(order)} className="inline-flex items-center gap-1 text-gray-700 hover:text-gray-900 font-medium text-sm"><Eye className="w-4 h-4" />Ver detalles<ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <div><h3 className="text-lg font-bold text-gray-900">Pedido {selectedOrder.orderNumber}</h3><p className="text-sm text-gray-500">{formatDate(selectedOrder.createdAt)}</p></div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-100 rounded-full"><XCircle className="w-6 h-6 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-medium ${ORDER_STATUS_COLORS[selectedOrder.status]}`}>{STATUS_ICONS[selectedOrder.status]}{ORDER_STATUS_USER_LABELS[selectedOrder.status]}</span>
              </div>

              {/* Sección de Pago */}
              <div className="p-4 bg-gray-100 rounded-xl">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Información de Pago
                </h4>
                {loadingPayments ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-6 h-6 text-violet-600 animate-spin" />
                  </div>
                ) : !orderPayments || orderPayments.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    <p className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-gray-400" />
                      No hay información de pago disponible
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orderPayments.map((payment) => {
                      const statusConfig = PAYMENT_STATUS_CONFIG[payment.status];
                      return (
                        <div key={payment.id} className="bg-white rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Estado del Pago</span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}
                            >
                              {statusConfig.icon}
                              {statusConfig.label}
                            </span>
                          </div>

                          <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                            <span className="text-sm text-gray-600">Método</span>
                            <span className="font-medium text-gray-900 capitalize">{payment.paymentMethod}</span>
                          </div>

                          {payment.transactionId && (
                            <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                              <span className="text-sm text-gray-600">Referencia</span>
                              <span className="font-mono font-bold text-violet-600 text-sm">{payment.transactionId}</span>
                            </div>
                          )}

                          {payment.receiptData && (
                            <div className="flex items-center gap-2 border-t border-gray-100 pt-2 text-green-600">
                              <FileText className="w-4 h-4" />
                              <span className="text-sm font-medium">Comprobante subido</span>
                            </div>
                          )}

                          {payment.status === 'PENDING' && !payment.receiptData && (
                            <div className="flex items-center gap-2 border-t border-gray-100 pt-2 text-yellow-600">
                              <AlertCircle className="w-4 h-4" />
                              <span className="text-sm">Pendiente de comprobante</span>
                            </div>
                          )}

                          {payment.failureReason && (
                            <div className="border-t border-gray-100 pt-2">
                              <p className="text-sm text-red-600">
                                <strong>Razón:</strong> {payment.failureReason}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sección de Tracking */}
              <div className="mt-4 p-4 bg-gray-100 rounded-xl">
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Información de Envío
                </h4>
                {selectedOrder.trackingNumber ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Número de guía:</span>
                      <span className="font-mono font-bold text-gray-900">{selectedOrder.trackingNumber}</span>
                    </div>
                    {selectedOrder.trackingUrl && (
                      <a
                        href={selectedOrder.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium w-full justify-center"
                      >
                        <Truck className="w-4 h-4" />
                        Rastrear mi pedido
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    {selectedOrder.status === 'pending' || selectedOrder.status === 'paid' || selectedOrder.status === 'processing' ? (
                      <p className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-yellow-500" />
                        Tu número de guía estará disponible cuando el pedido sea enviado
                      </p>
                    ) : selectedOrder.status === 'cancelled' ? (
                      <p className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-500" />
                        Pedido cancelado - No aplica envío
                      </p>
                    ) : (
                      <p>No hay información de rastreo disponible</p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Productos</h4>
                <div className="space-y-3">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      {item.productImage ? (
                        <img src={item.productImage} alt={item.productName} className="w-16 h-16 object-cover rounded-lg" />
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{item.productName}</p>
                        <p className="text-sm text-gray-500">{[item.size && `Talla: ${item.size}`, item.color && `Color: ${item.color}`, `Cant: ${item.quantity}`].filter(Boolean).join(' | ')}</p>
                        {item.customization && <p className="text-xs text-gray-600 font-medium mt-1">✨ Personalizado</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{formatCurrency(item.unitPrice * item.quantity)}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(item.unitPrice)} c/u</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><MapPin className="w-4 h-4" />Direccion de envio</h4>
                <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
                  <p className="font-medium text-gray-900">{selectedOrder.shipping.recipientName}</p>
                  <p>{selectedOrder.shipping.address}</p>
                  <p>{selectedOrder.shipping.city}{selectedOrder.shipping.postalCode && `, ${selectedOrder.shipping.postalCode}`}</p>
                  <p>{selectedOrder.shipping.phone}</p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4" />Resumen</h4>
                <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{formatCurrency(selectedOrder.subtotal)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Envio</span><span>{selectedOrder.shippingCost === 0 ? 'Gratis' : formatCurrency(selectedOrder.shippingCost)}</span></div>
                  {selectedOrder.discount > 0 && (<div className="flex justify-between text-green-600"><span>Descuento</span><span>-{formatCurrency(selectedOrder.discount)}</span></div>)}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200"><span>Total</span><span className="text-gray-900">{formatCurrency(selectedOrder.total)}</span></div>
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4">
              <button onClick={() => setSelectedOrder(null)} className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
