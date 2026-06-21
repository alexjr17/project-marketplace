import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrders } from '../../context/OrdersContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/shared/Button';
import { Input } from '../../components/shared/Input';
import { Modal } from '../../components/shared/Modal';
import type { Order, OrderStatus, PaymentEvidence } from '../../types/order';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
  EVIDENCE_TYPE_LABELS,
} from '../../types/order';
import {
  ArrowLeft,
  Package,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Truck,
  ExternalLink,
  Copy,
  FileText,
  Upload,
  Image,
  ArrowRight,
  AlertTriangle,
  History,
  Download,
  Printer,
  Loader2,
} from 'lucide-react';

type TabType = 'details' | 'items' | 'shipping' | 'status';

export const OrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getOrderById, changeOrderStatus, addEvidenceToStatus } = useOrders();
  const toast = useToast();

  const [order, setOrder] = useState<Order | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar orden al montar
  useEffect(() => {
    const loadOrder = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const orderData = await getOrderById(id);
        setOrder(orderData);
      } catch (error) {
        console.error('Error loading order:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadOrder();
  }, [id, getOrderById]);

  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [isChangeStatusOpen, setIsChangeStatusOpen] = useState(false);
  const [isAddEvidenceOpen, setIsAddEvidenceOpen] = useState(false);
  const [selectedHistoryEntryId, setSelectedHistoryEntryId] = useState<string | null>(null);

  // Form states
  const [statusFormData, setStatusFormData] = useState<{
    newStatus: OrderStatus;
    note: string;
    trackingNumber: string;
    trackingUrl: string;
    cancellationReason: string;
    evidenceType: PaymentEvidence['type'];
    evidenceUrl: string;
    evidenceDescription: string;
  }>({
    newStatus: 'pending',
    note: '',
    trackingNumber: '',
    trackingUrl: '',
    cancellationReason: '',
    evidenceType: 'receipt',
    evidenceUrl: '',
    evidenceDescription: '',
  });

  const [evidenceFormData, setEvidenceFormData] = useState({
    type: 'receipt' as PaymentEvidence['type'],
    url: '',
    description: '',
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 text-orange-500 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Cargando pedido...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-4 md:p-8">
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Pedido no encontrado</h2>
          <p className="text-gray-600 mb-4">El pedido que buscas no existe</p>
          <Button onClick={() => navigate('/admin-panel/orders')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Pedidos
          </Button>
        </div>
      </div>
    );
  }

  const handleCopyOrderNumber = () => {
    navigator.clipboard.writeText(order.orderNumber);
    toast.success('Número de pedido copiado');
  };

  // Descargar diseño como PNG
  const handleDownloadDesign = (designUrl: string, itemName: string, side: 'front' | 'back') => {
    try {
      const link = document.createElement('a');
      link.href = designUrl;
      const fileName = `${order.orderNumber}_${itemName.replace(/\s+/g, '-')}_${side === 'front' ? 'frente' : 'espalda'}.png`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Diseño descargado: ${fileName}`);
    } catch {
      toast.error('Error al descargar el diseño');
    }
  };

  // Obtener la mejor imagen disponible (original si existe, sino preview)
  const getBestImage = (item: typeof order.items[0], side: 'front' | 'back'): string | undefined => {
    if (!item.customization) return undefined;

    if (side === 'front') {
      // Preferir imagen original si existe
      return item.customization.originalFront || item.customization.designFront;
    } else {
      return item.customization.originalBack || item.customization.designBack;
    }
  };

  // Verificar si tiene imagen original (alta calidad)
  const hasOriginalImage = (item: typeof order.items[0], side: 'front' | 'back'): boolean => {
    if (!item.customization) return false;
    return side === 'front'
      ? !!item.customization.originalFront
      : !!item.customization.originalBack;
  };

  // Descargar todos los diseños de un item
  const handleDownloadAllDesigns = (item: typeof order.items[0]) => {
    if (!item.customization) return;

    const frontImage = getBestImage(item, 'front');
    const backImage = getBestImage(item, 'back');

    if (frontImage) {
      handleDownloadDesign(frontImage, item.productName, 'front');
    }
    if (backImage) {
      setTimeout(() => {
        handleDownloadDesign(backImage!, item.productName, 'back');
      }, 500);
    }
  };

  // Descargar todos los diseños del pedido
  const handleDownloadAllOrderDesigns = () => {
    const itemsWithDesigns = order.items.filter(item => item.customization);
    if (itemsWithDesigns.length === 0) {
      toast.info('Este pedido no tiene productos personalizados');
      return;
    }

    let delay = 0;
    itemsWithDesigns.forEach((item) => {
      const frontImage = getBestImage(item, 'front');
      const backImage = getBestImage(item, 'back');

      if (frontImage) {
        setTimeout(() => {
          handleDownloadDesign(frontImage, item.productName, 'front');
        }, delay);
        delay += 500;
      }
      if (backImage) {
        setTimeout(() => {
          handleDownloadDesign(backImage, item.productName, 'back');
        }, delay);
        delay += 500;
      }
    });

    toast.success(`Descargando ${itemsWithDesigns.length} diseño(s) en calidad original...`);
  };

  const handleOpenChangeStatus = () => {
    setStatusFormData({
      newStatus: order.status,
      note: '',
      trackingNumber: order.trackingNumber || '',
      trackingUrl: order.trackingUrl || '',
      cancellationReason: '',
      evidenceType: 'receipt',
      evidenceUrl: '',
      evidenceDescription: '',
    });
    setIsChangeStatusOpen(true);
  };

  const handleChangeStatus = async () => {
    const { newStatus, note, trackingNumber, trackingUrl, cancellationReason, evidenceType, evidenceUrl, evidenceDescription } = statusFormData;

    if (newStatus === order.status) {
      toast.error('Selecciona un estado diferente');
      return;
    }

    // Validaciones por estado
    if (newStatus === 'shipped' && !trackingNumber) {
      toast.error('Ingresa el número de guía para marcar como enviado');
      return;
    }

    if (newStatus === 'cancelled' && !cancellationReason) {
      toast.error('Ingresa el motivo de cancelación');
      return;
    }

    // Preparar evidencias si las hay
    const evidences = evidenceUrl
      ? [{ type: evidenceType, url: evidenceUrl, description: evidenceDescription, uploadedBy: 'Admin' }]
      : undefined;

    try {
      await changeOrderStatus({
        orderId: String(order.id),
        newStatus,
        note: note || undefined,
        evidences,
        trackingNumber: newStatus === 'shipped' ? trackingNumber : undefined,
        trackingUrl: newStatus === 'shipped' ? trackingUrl : undefined,
        cancellationReason: newStatus === 'cancelled' ? cancellationReason : undefined,
      });

      // Recargar la orden para ver los cambios
      const updatedOrder = await getOrderById(String(order.id));
      setOrder(updatedOrder);

      toast.success(`Estado cambiado a "${ORDER_STATUS_LABELS[newStatus]}"`);
      setIsChangeStatusOpen(false);
    } catch (error) {
      toast.error('Error al cambiar el estado del pedido');
      console.error('Error changing status:', error);
    }
  };

  const handleOpenAddEvidence = (historyEntryId: string) => {
    setSelectedHistoryEntryId(historyEntryId);
    setEvidenceFormData({ type: 'receipt', url: '', description: '' });
    setIsAddEvidenceOpen(true);
  };

  const handleAddEvidence = () => {
    if (!selectedHistoryEntryId || !evidenceFormData.url) {
      toast.error('Ingresa la URL del archivo');
      return;
    }

    addEvidenceToStatus(order.id, selectedHistoryEntryId, {
      type: evidenceFormData.type,
      url: evidenceFormData.url,
      description: evidenceFormData.description || undefined,
      uploadedBy: 'Admin',
    });

    toast.success('Evidencia agregada correctamente');
    setIsAddEvidenceOpen(false);
    setSelectedHistoryEntryId(null);
  };

  const tabs = [
    { id: 'details' as TabType, label: 'Detalles', icon: FileText },
    { id: 'items' as TabType, label: 'Productos', icon: Package },
    { id: 'shipping' as TabType, label: 'Envío', icon: Truck },
    { id: 'status' as TabType, label: 'Estados', icon: History },
  ];

  // Estados disponibles según el estado actual
  const getAvailableStatuses = (): OrderStatus[] => {
    if (order.status === 'cancelled' || order.status === 'delivered') {
      return []; // Estados finales
    }

    const statusFlow: Record<OrderStatus, OrderStatus[]> = {
      pending: ['paid', 'cancelled'],
      paid: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: [],
      cancelled: [],
    };

    return statusFlow[order.status] || [];
  };

  const availableStatuses = getAvailableStatuses();

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin-panel/orders')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{order.orderNumber}</h1>
              <button
                onClick={handleCopyOrderNumber}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Copiar número"
              >
                <Copy className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <p className="text-gray-600 mt-1 text-sm">
              Creado el {new Date(order.createdAt).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Order Header Card */}
      <div className="bg-white rounded-lg shadow-sm mb-6 overflow-hidden">
        <div className="bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg bg-white flex items-center justify-center shadow-lg">
                <Package className="w-8 h-8 text-orange-500" />
              </div>
              <div className="text-white">
                <h2 className="text-xl font-bold">{order.userName}</h2>
                <p className="text-orange-100">{order.userEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${ORDER_STATUS_COLORS[order.status]}`}>
                {ORDER_STATUS_LABELS[order.status]}
              </span>
              <span className="px-3 py-1.5 bg-white/20 text-white rounded-full text-sm font-medium">
                {PAYMENT_METHOD_LABELS[order.paymentMethod]}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200 border-b border-gray-200">
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{order.items.length}</p>
            <p className="text-xs text-gray-500">Productos</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {order.items.reduce((acc, item) => acc + item.quantity, 0)}
            </p>
            <p className="text-xs text-gray-500">Unidades</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              ${order.subtotal.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">Subtotal</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">
              ${order.total.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900">Información del Pedido</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cliente */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Datos del Cliente
                </h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">{order.userName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">{order.userEmail}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">{order.shipping.phone}</span>
                  </div>
                </div>
              </div>

              {/* Pago */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Información de Pago
                </h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Método</span>
                    <span className="font-medium text-gray-900">
                      {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                    </span>
                  </div>
                  {order.paymentReference && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Referencia</span>
                      <span className="font-medium text-gray-900">{order.paymentReference}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="text-gray-900">${order.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Envío</span>
                    <span className="text-gray-900">
                      {order.shippingCost > 0 ? `$${order.shippingCost.toLocaleString()}` : 'Gratis'}
                    </span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Descuento</span>
                      <span className="text-green-600">-${order.discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-3">
                    <span className="font-medium text-gray-900">Total</span>
                    <span className="font-bold text-orange-600">${order.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Items Tab */}
        {activeTab === 'items' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Productos del Pedido</h3>
              {order.items.some(item => item.customization) && (
                <Button
                  variant="admin-secondary"
                  onClick={handleDownloadAllOrderDesigns}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Descargar Todos los Diseños
                </Button>
              )}
            </div>

            <div className="space-y-4">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex gap-4">
                    <img
                      src={item.productImage}
                      alt={item.productName}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.productName}</h4>
                      {(item.size || item.color) && (
                        <div className="flex gap-4 mt-1 text-sm text-gray-500">
                          {item.size && <span>Talla: {item.size}</span>}
                          {item.color && <span>Color: {item.color}</span>}
                        </div>
                      )}
                      {item.customization && (
                        <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                          <Printer className="w-3 h-3" />
                          Personalizado
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        ${(item.unitPrice * item.quantity).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        {item.quantity} x ${item.unitPrice.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Diseños personalizados */}
                  {item.customization && (item.customization.designFront || item.customization.designBack) && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Printer className="w-4 h-4 text-purple-600" />
                          Diseños para Producción
                          {(hasOriginalImage(item, 'front') || hasOriginalImage(item, 'back')) && (
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                              HD
                            </span>
                          )}
                        </h5>
                        <button
                          onClick={() => handleDownloadAllDesigns(item)}
                          className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium"
                        >
                          <Download className="w-4 h-4" />
                          Descargar todos
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Diseño Frente */}
                        {item.customization.designFront && (
                          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="bg-gray-100 px-3 py-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700">Frente</span>
                                {hasOriginalImage(item, 'front') && (
                                  <span className="px-1 py-0.5 bg-green-100 text-green-600 text-xs rounded">Original</span>
                                )}
                              </div>
                              <button
                                onClick={() => handleDownloadDesign(getBestImage(item, 'front')!, item.productName, 'front')}
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                title={hasOriginalImage(item, 'front') ? 'Descargar en calidad original' : 'Descargar diseño frontal'}
                              >
                                <Download className="w-4 h-4 text-gray-600" />
                              </button>
                            </div>
                            <div className="p-2">
                              <img
                                src={item.customization.designFront}
                                alt={`${item.productName} - Frente`}
                                className="w-full h-40 object-contain bg-white rounded"
                              />
                            </div>
                          </div>
                        )}

                        {/* Diseño Espalda */}
                        {item.customization.designBack && (
                          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="bg-gray-100 px-3 py-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700">Espalda</span>
                                {hasOriginalImage(item, 'back') && (
                                  <span className="px-1 py-0.5 bg-green-100 text-green-600 text-xs rounded">Original</span>
                                )}
                              </div>
                              <button
                                onClick={() => handleDownloadDesign(getBestImage(item, 'back')!, item.productName, 'back')}
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                title={hasOriginalImage(item, 'back') ? 'Descargar en calidad original' : 'Descargar diseño trasero'}
                              >
                                <Download className="w-4 h-4 text-gray-600" />
                              </button>
                            </div>
                            <div className="p-2">
                              <img
                                src={item.customization.designBack}
                                alt={`${item.productName} - Espalda`}
                                className="w-full h-40 object-contain bg-white rounded"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shipping Tab */}
        {activeTab === 'shipping' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900">Información de Envío</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Dirección */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Dirección de Entrega
                </h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <p className="font-medium text-gray-900">{order.shipping.recipientName}</p>
                  <p className="text-gray-600">{order.shipping.address}</p>
                  <p className="text-gray-600">
                    {order.shipping.city}, {order.shipping.postalCode}
                  </p>
                  <p className="text-gray-600">{order.shipping.country}</p>
                  <p className="text-gray-600">{order.shipping.phone}</p>
                  {order.shipping.notes && (
                    <p className="text-sm text-gray-500 mt-2 pt-2 border-t">
                      <span className="font-medium">Notas:</span> {order.shipping.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Tracking */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Seguimiento
                </h4>
                {order.trackingNumber ? (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div>
                      <p className="text-sm text-gray-500">Número de Guía</p>
                      <p className="font-medium text-gray-900">{order.trackingNumber}</p>
                    </div>
                    {order.trackingUrl && (
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700"
                      >
                        Ver seguimiento
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <Truck className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">Sin información de envío</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Status Tab - Historial de Estados */}
        {activeTab === 'status' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Historial de Estados</h3>
              {availableStatuses.length > 0 && (
                <Button onClick={handleOpenChangeStatus}>
                  Cambiar Estado
                </Button>
              )}
            </div>

            {/* Estado actual */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Estado Actual</p>
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium mt-1 ${ORDER_STATUS_COLORS[order.status]}`}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>
                {availableStatuses.length > 0 && (
                  <div className="text-right">
                    <p className="text-sm text-gray-500 mb-1">Siguiente estado disponible:</p>
                    <div className="flex gap-2 flex-wrap justify-end">
                      {availableStatuses.map((status) => (
                        <span
                          key={status}
                          className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${ORDER_STATUS_COLORS[status]}`}
                        >
                          {ORDER_STATUS_LABELS[status]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline de estados */}
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-6">
                {[...order.statusHistory].reverse().map((entry, index) => (
                  <div key={entry.id} className="relative flex gap-4 pl-14">
                    <div
                      className={`absolute left-4 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        index === 0
                          ? 'bg-orange-500 border-orange-500'
                          : 'bg-white border-gray-300'
                      }`}
                    >
                      {index === 0 && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>

                    <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          {entry.fromStatus && (
                            <>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ORDER_STATUS_COLORS[entry.fromStatus]}`}>
                                {ORDER_STATUS_LABELS[entry.fromStatus]}
                              </span>
                              <ArrowRight className="w-4 h-4 text-gray-400" />
                            </>
                          )}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ORDER_STATUS_COLORS[entry.toStatus]}`}>
                            {ORDER_STATUS_LABELS[entry.toStatus]}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(entry.changedAt).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Info */}
                      <p className="text-sm text-gray-500 mb-2">
                        Por: <span className="font-medium text-gray-700">{entry.changedBy}</span>
                      </p>

                      {entry.note && (
                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded mb-3">
                          {entry.note}
                        </p>
                      )}

                      {/* Tracking info */}
                      {entry.trackingNumber && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                          <Truck className="w-4 h-4" />
                          <span>Guía: {entry.trackingNumber}</span>
                          {entry.trackingUrl && (
                            <a
                              href={entry.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-orange-600 hover:text-orange-700"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* Cancellation reason */}
                      {entry.cancellationReason && (
                        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-2 rounded mb-3">
                          <AlertTriangle className="w-4 h-4 mt-0.5" />
                          <span>{entry.cancellationReason}</span>
                        </div>
                      )}

                      {/* Evidences */}
                      {entry.evidences && entry.evidences.length > 0 && (
                        <div className="border-t pt-3 mt-3">
                          <p className="text-sm font-medium text-gray-700 mb-2">Evidencias:</p>
                          <div className="space-y-2">
                            {entry.evidences.map((evidence) => (
                              <div
                                key={evidence.id}
                                className="flex items-center gap-3 bg-blue-50 p-2 rounded text-sm"
                              >
                                <Image className="w-4 h-4 text-blue-600" />
                                <div className="flex-1">
                                  <span className="font-medium text-blue-800">
                                    {EVIDENCE_TYPE_LABELS[evidence.type]}
                                  </span>
                                  {evidence.description && (
                                    <span className="text-blue-600 ml-2">- {evidence.description}</span>
                                  )}
                                </div>
                                <a
                                  href={evidence.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Agregar evidencia - solo para estados de pago o cancelación */}
                      {(entry.toStatus === 'paid' || entry.toStatus === 'cancelled') && (
                        <button
                          onClick={() => handleOpenAddEvidence(entry.id)}
                          className="mt-3 flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700"
                        >
                          <Upload className="w-4 h-4" />
                          Agregar evidencia
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Change Status Modal */}
      <Modal
        isOpen={isChangeStatusOpen}
        onClose={() => setIsChangeStatusOpen(false)}
        title="Cambiar Estado del Pedido"
      >
        <div className="space-y-4">
          {/* Seleccionar nuevo estado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nuevo Estado
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availableStatuses.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFormData({ ...statusFormData, newStatus: status })}
                  className={`p-3 rounded-lg border-2 text-left transition-colors ${
                    statusFormData.newStatus === status
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ORDER_STATUS_COLORS[status]}`}>
                    {ORDER_STATUS_LABELS[status]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Campos según el estado seleccionado */}
          {statusFormData.newStatus === 'shipped' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Guía *
                </label>
                <Input
                  type="text"
                  value={statusFormData.trackingNumber}
                  onChange={(e) => setStatusFormData({ ...statusFormData, trackingNumber: e.target.value })}
                  placeholder="Ej: COL123456789"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL de Seguimiento
                </label>
                <Input
                  type="url"
                  value={statusFormData.trackingUrl}
                  onChange={(e) => setStatusFormData({ ...statusFormData, trackingUrl: e.target.value })}
                  placeholder="https://tracking.example.com/..."
                />
              </div>
            </>
          )}

          {statusFormData.newStatus === 'cancelled' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo de Cancelación *
              </label>
              <textarea
                value={statusFormData.cancellationReason}
                onChange={(e) => setStatusFormData({ ...statusFormData, cancellationReason: e.target.value })}
                placeholder="Describe el motivo de la cancelación..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              />
            </div>
          )}

          {statusFormData.newStatus === 'paid' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Evidencia
                </label>
                <select
                  value={statusFormData.evidenceType}
                  onChange={(e) => setStatusFormData({ ...statusFormData, evidenceType: e.target.value as PaymentEvidence['type'] })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="receipt">Recibo</option>
                  <option value="transfer">Comprobante de Transferencia</option>
                  <option value="voucher">Voucher</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL del Comprobante
                </label>
                <Input
                  type="url"
                  value={statusFormData.evidenceUrl}
                  onChange={(e) => setStatusFormData({ ...statusFormData, evidenceUrl: e.target.value })}
                  placeholder="https://example.com/comprobante.pdf"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <Input
                  type="text"
                  value={statusFormData.evidenceDescription}
                  onChange={(e) => setStatusFormData({ ...statusFormData, evidenceDescription: e.target.value })}
                  placeholder="Descripción del comprobante"
                />
              </div>
            </>
          )}

          {/* Nota */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nota (opcional)
            </label>
            <textarea
              value={statusFormData.note}
              onChange={(e) => setStatusFormData({ ...statusFormData, note: e.target.value })}
              placeholder="Agrega una nota sobre este cambio de estado..."
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="admin-secondary"
              onClick={() => setIsChangeStatusOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button onClick={handleChangeStatus} className="flex-1">
              Cambiar Estado
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Evidence Modal */}
      <Modal
        isOpen={isAddEvidenceOpen}
        onClose={() => {
          setIsAddEvidenceOpen(false);
          setSelectedHistoryEntryId(null);
        }}
        title="Agregar Evidencia"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Evidencia
            </label>
            <select
              value={evidenceFormData.type}
              onChange={(e) => setEvidenceFormData({ ...evidenceFormData, type: e.target.value as PaymentEvidence['type'] })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="receipt">Recibo</option>
              <option value="transfer">Comprobante de Transferencia</option>
              <option value="voucher">Voucher</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL del Archivo *
            </label>
            <Input
              type="url"
              value={evidenceFormData.url}
              onChange={(e) => setEvidenceFormData({ ...evidenceFormData, url: e.target.value })}
              placeholder="https://example.com/archivo.pdf"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <Input
              type="text"
              value={evidenceFormData.description}
              onChange={(e) => setEvidenceFormData({ ...evidenceFormData, description: e.target.value })}
              placeholder="Descripción del archivo"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="admin-secondary"
              onClick={() => {
                setIsAddEvidenceOpen(false);
                setSelectedHistoryEntryId(null);
              }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button onClick={handleAddEvidence} className="flex-1">
              <Upload className="w-4 h-4 mr-2" />
              Agregar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
