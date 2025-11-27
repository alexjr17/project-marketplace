import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  ArrowLeft,
  User,
  MapPin,
  CreditCard,
  Building2,
  Wallet,
  Banknote,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useOrders } from '../context/OrdersContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { Input } from '../components/shared/Input';
import { Button } from '../components/shared/Button';
import type { PaymentMethod } from '../types/order';

interface FormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingPostalCode: string;
  shippingNotes: string;
  paymentMethod: PaymentMethod;
}

interface FormErrors {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  shippingCity?: string;
  paymentMethod?: string;
}

export const CheckoutPage = () => {
  const navigate = useNavigate();
  const { cart, clearCart } = useCart();
  const { createOrder } = useOrders();
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [formData, setFormData] = useState<FormData>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    shippingAddress: '',
    shippingCity: '',
    shippingPostalCode: '',
    shippingNotes: '',
    paymentMethod: 'transfer',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'info' | 'payment' | 'review'>('info');

  // Redirect if cart is empty
  useEffect(() => {
    if (cart.items.length === 0) {
      navigate('/cart');
    }
  }, [cart.items.length, navigate]);

  const activePaymentMethods = settings.payment.methods.filter((m) => m.isActive);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.customerName.trim()) {
      newErrors.customerName = 'El nombre es requerido';
    }

    if (!formData.customerEmail.trim()) {
      newErrors.customerEmail = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customerEmail)) {
      newErrors.customerEmail = 'Email inválido';
    }

    if (!formData.customerPhone.trim()) {
      newErrors.customerPhone = 'El teléfono es requerido';
    }

    if (!formData.shippingAddress.trim()) {
      newErrors.shippingAddress = 'La dirección es requerida';
    }

    if (!formData.shippingCity.trim()) {
      newErrors.shippingCity = 'La ciudad es requerida';
    }

    if (!formData.paymentMethod) {
      newErrors.paymentMethod = 'Selecciona un método de pago';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    setFormData((prev) => ({ ...prev, paymentMethod: method }));
    if (errors.paymentMethod) {
      setErrors((prev) => ({ ...prev, paymentMethod: undefined }));
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      showToast('Por favor completa todos los campos requeridos', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // Simular delay de procesamiento
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const orderItems = cart.items.map((item) => {
        if (item.type === 'customized') {
          const customized = item.customizedProduct;
          return {
            productId: customized.productId,
            productName: customized.productName,
            productImage: customized.previewImages.front,
            size: customized.selectedSize,
            color: customized.selectedColor,
            quantity: item.quantity,
            unitPrice: item.price,
            customization: {
              designFront: customized.previewImages.front,
              designBack: customized.previewImages.back,
            },
          };
        } else {
          const standardItem = item as import('../types/cart').CartItem;
          return {
            productId: standardItem.product.id,
            productName: standardItem.product.name,
            productImage: standardItem.product.images.front,
            size: standardItem.selectedSize,
            color: standardItem.selectedColor,
            quantity: item.quantity,
            unitPrice: item.price,
          };
        }
      });

      const order = createOrder({
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone,
        shippingAddress: formData.shippingAddress,
        shippingCity: formData.shippingCity,
        shippingPostalCode: formData.shippingPostalCode,
        shippingNotes: formData.shippingNotes,
        paymentMethod: formData.paymentMethod,
        items: orderItems,
        subtotal: cart.subtotal,
        shippingCost: cart.shipping,
        discount: cart.discount,
        total: cart.total,
      });

      // Limpiar carrito
      clearCart();

      // Redirigir a página de confirmación
      navigate(`/order-confirmation/${order.orderNumber}`);
    } catch {
      showToast('Error al procesar el pedido. Intenta de nuevo.', 'error');
    } finally {
      setIsSubmitting(false);
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: settings.general.currency || 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const steps = [
    { id: 'info', label: 'Información', icon: User },
    { id: 'payment', label: 'Pago', icon: CreditCard },
    { id: 'review', label: 'Confirmar', icon: CheckCircle2 },
  ];

  const canProceedToPayment = formData.customerName && formData.customerEmail && formData.customerPhone && formData.shippingAddress && formData.shippingCity;
  const canProceedToReview = canProceedToPayment && formData.paymentMethod;

  if (cart.items.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/cart')}
            className="flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al carrito
          </button>

          <div className="flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-900">Finalizar Compra</h1>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-8">
          <div className="flex items-center justify-between max-w-md mx-auto">
            {steps.map((s, index) => (
              <div key={s.id} className="flex items-center">
                <button
                  onClick={() => {
                    if (s.id === 'info') setStep('info');
                    else if (s.id === 'payment' && canProceedToPayment) setStep('payment');
                    else if (s.id === 'review' && canProceedToReview) setStep('review');
                  }}
                  className={`flex flex-col items-center gap-1 transition-colors ${
                    step === s.id
                      ? 'text-purple-600'
                      : steps.findIndex((x) => x.id === step) > index
                      ? 'text-green-600'
                      : 'text-gray-400'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      step === s.id
                        ? 'border-purple-600 bg-purple-50'
                        : steps.findIndex((x) => x.id === step) > index
                        ? 'border-green-600 bg-green-50'
                        : 'border-gray-300'
                    }`}
                  >
                    <s.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium">{s.label}</span>
                </button>
                {index < steps.length - 1 && (
                  <ChevronRight className="w-5 h-5 text-gray-300 mx-2" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Customer Information */}
            {step === 'info' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-600" />
                  Información del Cliente
                </h2>

                <div className="space-y-4">
                  <Input
                    label="Nombre completo *"
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleInputChange}
                    error={errors.customerName}
                    placeholder="Juan Pérez"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Correo electrónico *"
                      name="customerEmail"
                      type="email"
                      value={formData.customerEmail}
                      onChange={handleInputChange}
                      error={errors.customerEmail}
                      placeholder="correo@ejemplo.com"
                    />
                    <Input
                      label="Teléfono *"
                      name="customerPhone"
                      type="tel"
                      value={formData.customerPhone}
                      onChange={handleInputChange}
                      error={errors.customerPhone}
                      placeholder="+57 300 123 4567"
                    />
                  </div>

                  <div className="border-t pt-4 mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-purple-600" />
                      Dirección de Envío
                    </h3>

                    <Input
                      label="Dirección completa *"
                      name="shippingAddress"
                      value={formData.shippingAddress}
                      onChange={handleInputChange}
                      error={errors.shippingAddress}
                      placeholder="Calle 123 #45-67, Apto 301"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <Input
                        label="Ciudad *"
                        name="shippingCity"
                        value={formData.shippingCity}
                        onChange={handleInputChange}
                        error={errors.shippingCity}
                        placeholder="Bogotá"
                      />
                      <Input
                        label="Código postal"
                        name="shippingPostalCode"
                        value={formData.shippingPostalCode}
                        onChange={handleInputChange}
                        placeholder="110111"
                      />
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notas de entrega (opcional)
                      </label>
                      <textarea
                        name="shippingNotes"
                        value={formData.shippingNotes}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-500 transition-all"
                        placeholder="Edificio azul, portería 24h, timbre..."
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={() => setStep('payment')}
                      disabled={!canProceedToPayment}
                    >
                      Continuar al Pago
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Payment Method */}
            {step === 'payment' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                  Método de Pago
                </h2>

                {errors.paymentMethod && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-4 h-4" />
                    {errors.paymentMethod}
                  </div>
                )}

                <div className="space-y-3">
                  {activePaymentMethods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => handlePaymentMethodChange(method.type)}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                        formData.paymentMethod === method.type
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            formData.paymentMethod === method.type
                              ? 'bg-purple-100 text-purple-600'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {getPaymentIcon(method.type)}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{method.name}</p>
                          {method.description && (
                            <p className="text-sm text-gray-500">{method.description}</p>
                          )}
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            formData.paymentMethod === method.type
                              ? 'border-purple-500 bg-purple-500'
                              : 'border-gray-300'
                          }`}
                        >
                          {formData.paymentMethod === method.type && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                      </div>

                      {/* Show bank info for transfer */}
                      {formData.paymentMethod === method.type &&
                        method.type === 'transfer' &&
                        method.bankInfo && (
                          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-700 mb-2">
                              Datos para transferencia:
                            </p>
                            <div className="text-sm text-gray-600 space-y-1">
                              <p>
                                <span className="font-medium">Banco:</span> {method.bankInfo.bankName}
                              </p>
                              <p>
                                <span className="font-medium">Tipo:</span> {method.bankInfo.accountType}
                              </p>
                              <p>
                                <span className="font-medium">Número:</span> {method.bankInfo.accountNumber}
                              </p>
                              <p>
                                <span className="font-medium">Titular:</span> {method.bankInfo.accountHolder}
                              </p>
                              <p>
                                <span className="font-medium">{method.bankInfo.documentType}:</span>{' '}
                                {method.bankInfo.documentNumber}
                              </p>
                            </div>
                          </div>
                        )}

                      {/* Show instructions if any */}
                      {formData.paymentMethod === method.type && method.instructions && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-700">{method.instructions}</p>
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex justify-between pt-6">
                  <Button variant="outline" onClick={() => setStep('info')}>
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Volver
                  </Button>
                  <Button onClick={() => setStep('review')} disabled={!canProceedToReview}>
                    Revisar Pedido
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Review Order */}
            {step === 'review' && (
              <div className="space-y-6">
                {/* Customer Info Summary */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <User className="w-5 h-5 text-purple-600" />
                      Información del Cliente
                    </h2>
                    <button
                      onClick={() => setStep('info')}
                      className="text-purple-600 text-sm font-medium hover:underline"
                    >
                      Editar
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Nombre</p>
                      <p className="font-medium text-gray-900">{formData.customerName}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Email</p>
                      <p className="font-medium text-gray-900">{formData.customerEmail}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Teléfono</p>
                      <p className="font-medium text-gray-900">{formData.customerPhone}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Dirección</p>
                      <p className="font-medium text-gray-900">
                        {formData.shippingAddress}, {formData.shippingCity}
                        {formData.shippingPostalCode && ` - ${formData.shippingPostalCode}`}
                      </p>
                    </div>
                  </div>
                  {formData.shippingNotes && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-gray-500 text-sm">Notas de entrega</p>
                      <p className="font-medium text-gray-900 text-sm">{formData.shippingNotes}</p>
                    </div>
                  )}
                </div>

                {/* Payment Method Summary */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-purple-600" />
                      Método de Pago
                    </h2>
                    <button
                      onClick={() => setStep('payment')}
                      className="text-purple-600 text-sm font-medium hover:underline"
                    >
                      Cambiar
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                      {getPaymentIcon(formData.paymentMethod)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {activePaymentMethods.find((m) => m.type === formData.paymentMethod)?.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {activePaymentMethods.find((m) => m.type === formData.paymentMethod)?.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Products Summary */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-purple-600" />
                    Productos ({cart.totalItems})
                  </h2>
                  <div className="space-y-4">
                    {cart.items.map((item) => {
                      const isCustomized = item.type === 'customized';
                      let name: string;
                      let image: string;
                      let size: string;
                      let color: string;

                      if (isCustomized) {
                        const customized = item.customizedProduct;
                        name = customized.productName;
                        image = customized.previewImages.front;
                        size = customized.selectedSize;
                        color = customized.selectedColor;
                      } else {
                        const standardItem = item as import('../types/cart').CartItem;
                        name = standardItem.product.name;
                        image = standardItem.product.images.front;
                        size = standardItem.selectedSize;
                        color = standardItem.selectedColor;
                      }

                      return (
                        <div key={item.id} className="flex gap-4 pb-4 border-b last:border-0">
                          <img
                            src={image}
                            alt={name}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{name}</p>
                            <p className="text-sm text-gray-500">
                              {size} / {color} • Cantidad: {item.quantity}
                            </p>
                            {isCustomized && (
                              <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                                Personalizado
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-gray-900">{formatCurrency(item.subtotal)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep('payment')}>
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Volver
                  </Button>
                  <Button onClick={handleSubmit} isLoading={isSubmitting} size="lg">
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Confirmar Pedido
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Resumen del Pedido</h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal ({cart.totalItems} items)</span>
                  <span className="font-medium">{formatCurrency(cart.subtotal)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Impuestos (16%)</span>
                  <span className="font-medium">{formatCurrency(cart.tax)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Envío</span>
                  <span className={`font-medium ${cart.shipping === 0 ? 'text-green-600' : ''}`}>
                    {cart.shipping === 0 ? 'Gratis' : formatCurrency(cart.shipping)}
                  </span>
                </div>

                {cart.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Descuento</span>
                    <span className="font-medium">-{formatCurrency(cart.discount)}</span>
                  </div>
                )}

                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-purple-600">{formatCurrency(cart.total)}</span>
                  </div>
                </div>
              </div>

              {/* Trust badges */}
              <div className="mt-6 pt-6 border-t space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Pago 100% seguro</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Envío con seguimiento</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Garantía de satisfacción</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
