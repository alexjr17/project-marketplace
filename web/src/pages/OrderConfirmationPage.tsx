import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  CheckCircle2,
  Package,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Copy,
  Home,
  ShoppingBag,
  Clock,
  Building2,
  Wallet,
  Banknote,
} from 'lucide-react';
import { useOrders } from '../context/OrdersContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/shared/Button';
import type { Order } from '../types/order';

export const OrderConfirmationPage = () => {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();
  const { getOrderByNumber } = useOrders();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (orderNumber) {
      const foundOrder = getOrderByNumber(orderNumber);
      if (foundOrder) {
        setOrder(foundOrder);
      } else {
        navigate('/');
      }
    }
  }, [orderNumber, getOrderByNumber, navigate]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: settings.general.currency || 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const copyOrderNumber = () => {
    if (order) {
      navigator.clipboard.writeText(order.orderNumber);
      showToast('Número de pedido copiado', 'success');
    }
  };

  const getPaymentIcon = (type: string) => {
    switch (type) {
      case 'credit_card':
      case 'debit_card':
        return <CreditCard className="w-5 h-5" />;
      case 'pse':
        return <Building2 className="w-5 h-5" />;
      case 'transfer':
        return <Wallet className="w-5 h-5" />;
      case 'cash':
        return <Banknote className="w-5 h-5" />;
      default:
        return <CreditCard className="w-5 h-5" />;
    }
  };

  const getPaymentMethodDetails = () => {
    const method = settings.payment.methods.find((m) => m.type === order?.paymentMethod);
    return method;
  };

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const paymentMethod = getPaymentMethodDetails();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">¡Pedido Confirmado!</h1>
          <p className="text-gray-600">
            Hemos recibido tu pedido y te enviaremos actualizaciones por correo
          </p>
        </div>

        {/* Order Number */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Número de Pedido</p>
              <p className="text-2xl font-bold text-purple-600">{order.orderNumber}</p>
            </div>
            <button
              onClick={copyOrderNumber}
              className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="Copiar número de pedido"
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span>
              Creado el {new Date(order.createdAt).toLocaleDateString('es-CO', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        {/* Payment Instructions (if transfer) */}
        {order.paymentMethod === 'transfer' && paymentMethod?.bankInfo && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-bold text-yellow-800 mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Instrucciones de Pago
            </h2>
            <p className="text-yellow-700 mb-4">
              Para completar tu pedido, realiza la transferencia a la siguiente cuenta:
            </p>
            <div className="bg-white rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Banco:</span>
                <span className="font-medium">{paymentMethod.bankInfo.bankName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tipo de cuenta:</span>
                <span className="font-medium">{paymentMethod.bankInfo.accountType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Número de cuenta:</span>
                <span className="font-medium">{paymentMethod.bankInfo.accountNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Titular:</span>
                <span className="font-medium">{paymentMethod.bankInfo.accountHolder}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{paymentMethod.bankInfo.documentType}:</span>
                <span className="font-medium">{paymentMethod.bankInfo.documentNumber}</span>
              </div>
              <div className="flex justify-between pt-2 border-t mt-2">
                <span className="text-gray-600">Valor a transferir:</span>
                <span className="font-bold text-purple-600">{formatCurrency(order.total)}</span>
              </div>
            </div>
            <p className="text-sm text-yellow-700 mt-4">
              Usa tu número de pedido <strong>{order.orderNumber}</strong> como referencia de pago.
              Una vez realizada la transferencia, envía el comprobante a{' '}
              <strong>{settings.general.contactEmail}</strong>
            </p>
          </div>
        )}

        {/* Cash on delivery notice */}
        {order.paymentMethod === 'cash' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-bold text-blue-800 mb-2 flex items-center gap-2">
              <Banknote className="w-5 h-5" />
              Pago Contra Entrega
            </h2>
            <p className="text-blue-700">
              El pago de <strong>{formatCurrency(order.total)}</strong> se realizará al momento de
              recibir tu pedido. Ten el dinero exacto listo para el domiciliario.
            </p>
          </div>
        )}

        {/* Order Details */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          {/* Products */}
          <div className="p-6 border-b">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Productos ({order.items.length})
            </h2>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <img
                    src={item.productImage}
                    alt={item.productName}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{item.productName}</p>
                    <p className="text-sm text-gray-500">
                      {item.size} / {item.color} • x{item.quantity}
                    </p>
                    {item.customization && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                        Personalizado
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-gray-900">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="p-6 bg-gray-50">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Envío</span>
                <span className={order.shippingCost === 0 ? 'text-green-600' : ''}>
                  {order.shippingCost === 0 ? 'Gratis' : formatCurrency(order.shippingCost)}
                </span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Descuento</span>
                  <span>-{formatCurrency(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t font-bold text-lg">
                <span>Total</span>
                <span className="text-purple-600">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Shipping & Contact Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Shipping Address */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-600" />
              Dirección de Envío
            </h2>
            <div className="text-sm text-gray-600 space-y-1">
              <p className="font-medium text-gray-900">{order.shipping.recipientName}</p>
              <p>{order.shipping.address}</p>
              <p>
                {order.shipping.city}
                {order.shipping.postalCode && ` - ${order.shipping.postalCode}`}
              </p>
              <p>{order.shipping.country}</p>
              {order.shipping.notes && (
                <p className="mt-2 text-gray-500 italic">Nota: {order.shipping.notes}</p>
              )}
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-purple-600" />
              Contacto
            </h2>
            <div className="text-sm space-y-3">
              <div className="flex items-center gap-2 text-gray-600">
                <Mail className="w-4 h-4" />
                <span>{order.userEmail}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="w-4 h-4" />
                <span>{order.shipping.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                {getPaymentIcon(order.paymentMethod)}
                <span>{paymentMethod?.name || 'Método de pago'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-purple-50 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-bold text-purple-900 mb-4">¿Qué sigue?</h2>
          <ol className="space-y-3 text-sm text-purple-800">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0 font-medium">
                1
              </span>
              <span>
                Recibirás un correo de confirmación en <strong>{order.userEmail}</strong>
              </span>
            </li>
            {order.paymentMethod === 'transfer' && (
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0 font-medium">
                  2
                </span>
                <span>
                  Realiza la transferencia y envía el comprobante a{' '}
                  <strong>{settings.general.contactEmail}</strong>
                </span>
              </li>
            )}
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0 font-medium">
                {order.paymentMethod === 'transfer' ? '3' : '2'}
              </span>
              <span>Una vez confirmado el pago, comenzaremos a preparar tu pedido</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0 font-medium">
                {order.paymentMethod === 'transfer' ? '4' : '3'}
              </span>
              <span>Te notificaremos cuando tu pedido sea enviado con número de seguimiento</span>
            </li>
          </ol>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/">
            <Button variant="outline" size="lg">
              <Home className="w-5 h-5 mr-2" />
              Volver al Inicio
            </Button>
          </Link>
          <Link to="/catalog">
            <Button size="lg">
              <ShoppingBag className="w-5 h-5 mr-2" />
              Seguir Comprando
            </Button>
          </Link>
        </div>

        {/* Contact Support */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>
            ¿Tienes preguntas? Contáctanos a{' '}
            <a
              href={`mailto:${settings.general.contactEmail}`}
              className="text-purple-600 hover:underline"
            >
              {settings.general.contactEmail}
            </a>{' '}
            o al{' '}
            <a
              href={`tel:${settings.general.contactPhone}`}
              className="text-purple-600 hover:underline"
            >
              {settings.general.contactPhone}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
