import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  Truck,
  User,
  MapPin,
  CreditCard,
  ChevronRight,
  CheckCircle2,
  Zap,
  Building2,
  Banknote,
  Store,
  Clock,
  Phone,
  Edit3,
  Home,
  Ticket,
  Smartphone,
  Wallet,
  Upload,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useOrders } from '../context/OrdersContext';
import { usePayments } from '../context/PaymentsContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Alert, Badge, Button, Card, CardTitle, DescriptionList, EmptyState, Field, TextArea, TextInput } from '../components/ui';
import { WompiCheckout } from '../components/payment/WompiCheckout';
import { addressesService, type Address } from '../services/addresses.service';
import { quoteShipping } from '../utils/shippingQuote';
import { validateCoupon, type CouponResult } from '../services/discounts.service';
import { CitySelect } from '../components/shared/CitySelect';
import { PageHeader } from '../components/shared/PageHeader';
import paymentsService from '../services/payments.service';
import { ordersService } from '../services/orders.service';

interface FormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingPostalCode: string;
  shippingNotes: string;
}

interface FormErrors {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  shippingCity?: string;
}

export const CheckoutPage = () => {
  const navigate = useNavigate();
  const { cart, clearCart } = useCart();
  const { createOrder } = useOrders();
  const { createPayment, updateMyPayment } = usePayments();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    customerName: user?.name || '',
    customerEmail: user?.email || '',
    customerPhone: user?.profile?.phone || '',
    shippingAddress: user?.profile?.address || '',
    shippingCity: user?.profile?.city || '',
    shippingPostalCode: user?.profile?.postalCode || '',
    shippingNotes: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'info' | 'payment'>('info');
  // Referencia del pago manual (transferencia, Nequi…). Wompi usa el número del pedido.
  const [paymentReference, setPaymentReference] = useState('');
  // Pedido pendiente creado al pagar con Wompi: se reutiliza si el cliente reintenta.
  // Se guarda con la "huella" de lo que define su monto: si el cliente cambia dirección,
  // cupón, carrito o método, el pedido viejo se cancela y se crea otro con el monto correcto.
  const [wompiOrder, setWompiOrder] = useState<{ id: number; orderNumber: string; key: string } | null>(null);
  // Igual para Mercado Pago: un reintento sin cambios no crea otro pedido ni otro pago.
  const [mpOrder, setMpOrder] = useState<{ id: number; key: string; paymentCreated: boolean } | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  // Comprobante de pago (dataURL) para métodos manuales con verificación.
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [proofName, setProofName] = useState<string>('');

  // Direcciones guardadas del usuario. selectedAddressId = 'new' para escribir una nueva.
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | 'new'>('new');

  // Cupón de descuento (validado contra el backend, no se aplica hasta crear el pedido).
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<CouponResult | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);


  // Redirect if cart is empty
  useEffect(() => {
    if (cart.items.length === 0) {
      navigate('/cart');
    }
  }, [cart.items.length, navigate]);

  // Generar referencia única para el pago
  useEffect(() => {
    const ref = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    setPaymentReference(ref);
  }, []);

  // Obtener métodos de pago activos desde settings
  const activePaymentMethods = (settings.payment?.methods || []).filter((m) => m.isActive);
  const selectedMethod = activePaymentMethods.find((m) => m.id === selectedPaymentMethod);
  const wompiConfig = selectedMethod?.type === 'wompi' ? selectedMethod.wompiConfig : undefined;

  // Seleccionar primer método de pago activo por defecto
  useEffect(() => {
    if (activePaymentMethods.length > 0 && !selectedPaymentMethod) {
      setSelectedPaymentMethod(activePaymentMethods[0].id);
    }
  }, [activePaymentMethods, selectedPaymentMethod]);

  // Cargar direcciones guardadas y precargar la predeterminada.
  useEffect(() => {
    if (!user) return;
    let active = true;
    addressesService
      .list()
      .then((list) => {
        if (!active) return;
        setSavedAddresses(list);
        const def = list.find((a) => a.isDefault) ?? list[0];
        if (def) {
          setSelectedAddressId(def.id);
          setFormData((prev) => ({
            ...prev,
            shippingAddress: def.address,
            shippingCity: def.city,
            shippingPostalCode: def.postalCode || '',
          }));
        }
      })
      .catch(() => {
        /* sin direcciones guardadas: se usa el formulario manual */
      });
    return () => {
      active = false;
    };
  }, [user]);

  // Elegir una dirección guardada: rellena el formulario con sus datos.
  const selectSavedAddress = (a: Address) => {
    setSelectedAddressId(a.id);
    setFormData((prev) => ({
      ...prev,
      shippingAddress: a.address,
      shippingCity: a.city,
      shippingPostalCode: a.postalCode || '',
    }));
    setErrors((prev) => ({ ...prev, shippingAddress: undefined, shippingCity: undefined }));
  };

  // Cambiar a "otra dirección": limpia los campos para escribir una nueva.
  const selectNewAddress = () => {
    setSelectedAddressId('new');
    setFormData((prev) => ({
      ...prev,
      shippingAddress: '',
      shippingCity: '',
      shippingPostalCode: '',
    }));
  };

  // Cotización del envío según la ciudad destino y la configuración de zonas.
  const shippingQuote = useMemo(() => {
    if (!formData.shippingCity.trim()) return null;
    const perItem = settings.shipping?.packageDefaults?.defaultWeightPerItem ?? 0.5;
    const weight = perItem * Math.max(1, cart.totalItems);
    return quoteShipping(settings.shipping, formData.shippingCity, weight, cart.subtotal);
  }, [settings.shipping, formData.shippingCity, cart.totalItems, cart.subtotal]);

  // Costo de envío efectivo: el calculado por zona, o el estimado del carrito.
  const shippingCost = shippingQuote ? shippingQuote.cost : cart.shipping;
  // Días de preparación (alistamiento). La entrega estimada = preparación + tránsito de la transportadora.
  const handlingDays = settings.shipping?.handlingTime ?? 0;
  // Descuento efectivo: el del cupón validado, o el del carrito.
  const discountAmount = coupon ? coupon.amount : cart.discount;
  const orderTotal = Math.max(0, cart.subtotal + cart.tax + shippingCost - discountAmount);

  // Ítems mínimos para validar un cupón (el backend resuelve categoría/subtotal).
  const couponItems = useMemo(
    () =>
      cart.items.map((item) => {
        const raw =
          item.type === 'customized'
            ? item.customizedProduct.productId
            : (item as import('../types/cart').CartItem).product.id;
        const productId = typeof raw === 'string' ? (Number.isNaN(Number(raw)) ? 0 : Number(raw)) : Number(raw);
        return { productId, price: item.price, quantity: item.quantity };
      }),
    [cart.items]
  );

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponBusy(true);
    setCouponError('');
    try {
      const result = await validateCoupon(code, couponItems, 'online');
      setCoupon(result);
      showToast(`Cupón ${result.code} aplicado`, 'success');
    } catch (e) {
      setCoupon(null);
      setCouponError(e instanceof Error ? e.message : 'Cupón inválido');
    } finally {
      setCouponBusy(false);
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
    setCouponInput('');
    setCouponError('');
  };

  // Icono según tipo de método de pago
  const getPaymentIcon = (type: string) => {
    switch (type) {
      case 'wompi':
        return <Zap className="w-5 h-5" />;
      case 'transfer':
        return <Building2 className="w-5 h-5" />;
      case 'cash':
        return <Banknote className="w-5 h-5" />;
      case 'pickup':
        return <Store className="w-5 h-5" />;
      case 'nequi':
        return <Smartphone className="w-5 h-5" />;
      case 'mercadopago':
        return <Wallet className="w-5 h-5" />;
      default:
        return <CreditCard className="w-5 h-5" />;
    }
  };

  // Lee un archivo de imagen y lo guarda como dataURL para el comprobante.
  const handleProofFile = (file?: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('La imagen del comprobante no debe superar 5 MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProofImage(typeof reader.result === 'string' ? reader.result : null);
      setProofName(file.name);
    };
    reader.readAsDataURL(file);
  };

  // Uploader de comprobante para métodos manuales (cuando requireProof está activo).
  const renderProofUploader = () => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Comprobante de pago <span className="text-gray-400">(opcional)</span>
      </label>
      {proofImage ? (
        <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
          <img src={proofImage} alt="Comprobante" className="w-14 h-14 object-cover rounded-md border border-gray-200" />
          <span className="text-sm text-gray-600 truncate flex-1">{proofName || 'Comprobante adjunto'}</span>
          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => { setProofImage(null); setProofName(''); }}>
            Quitar
          </Button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-app-400 hover:bg-app-50 transition-colors">
          <Upload className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-500">Sube la captura de tu transferencia / pago</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleProofFile(e.target.files?.[0])}
          />
        </label>
      )}
      <p className="text-xs text-gray-400 mt-1">
        Verificaremos tu pago antes de procesar el pedido.
      </p>
    </div>
  );

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

  // Crea el pedido PENDIENTE. El paso a pagado lo hace el backend al confirmar con la pasarela.
  const createOrderFromCart = async () => {
    const orderItems = cart.items.map((item) => {
      if (item.type === 'customized') {
        const customized = item.customizedProduct;
        // Convertir productId a número - si es string numérico parsearlo, sino usar 1
        const productId = typeof customized.productId === 'string'
          ? (Number.isNaN(Number(customized.productId)) ? 1 : Number(customized.productId))
          : Number(customized.productId);

        return {
          productId: productId,
          productName: customized.productName,
          productImage: customized.previewImages.front,
          size: customized.selectedSize,
          color: customized.selectedColor,
          quantity: item.quantity,
          unitPrice: item.price,
          customization: {
            // Preview comprimido para visualización
            designFront: customized.previewImages.front,
            designBack: customized.previewImages.back,
            // Imágenes originales en alta calidad para producción
            originalFront: customized.productionImages?.front,
            originalBack: customized.productionImages?.back,
          },
        };
      } else {
        const standardItem = item as import('../types/cart').CartItem;
        // Convertir productId a número
        const productId = typeof standardItem.product.id === 'string'
          ? (Number.isNaN(Number(standardItem.product.id)) ? 1 : Number(standardItem.product.id))
          : Number(standardItem.product.id);

        return {
          productId: productId,
          productName: standardItem.product.name,
          productImage: standardItem.product.images.front,
          size: standardItem.selectedSize,
          color: standardItem.selectedColor,
          quantity: item.quantity,
          unitPrice: item.price,
        };
      }
    });

    const order = await createOrder({
      customerName: formData.customerName,
      customerEmail: formData.customerEmail,
      customerPhone: formData.customerPhone,
      shippingAddress: formData.shippingAddress,
      shippingCity: formData.shippingCity,
      shippingPostalCode: formData.shippingPostalCode,
      shippingNotes: formData.shippingNotes,
      paymentMethod: (selectedMethod?.type || 'wompi') as import('../types/order').PaymentMethod,
      items: orderItems,
      subtotal: cart.subtotal,
      shippingCost: shippingCost,
      discount: discountAmount,
      total: orderTotal,
      couponCode: coupon?.code,
    });

    return order;
  };

  // Huella del pedido: lo que cambia su monto o su destino.
  const orderKey = JSON.stringify({
    method: selectedMethod?.type,
    city: formData.shippingCity.trim().toLowerCase(),
    address: formData.shippingAddress.trim().toLowerCase(),
    postal: formData.shippingPostalCode.trim(),
    coupon: coupon?.code ?? null,
    items: cart.items.map((i) => [i.id, i.quantity, i.price]),
  });

  /** Cancela un pedido pendiente que quedó desactualizado (no bloquea si falla). */
  const discardStaleOrder = async (orderId: number) => {
    try { await ordersService.cancelMy(orderId); } catch { /* ya no está pendiente o sin red */ }
  };

  // Wompi: 1) crea el pedido pendiente (una sola vez), 2) el servidor entrega monto,
  // referencia (número del pedido) y firma. La clave de integridad nunca llega al navegador.
  const handleWompiPrepare = async () => {
    if (!validateForm()) throw new Error('Completa los campos requeridos antes de pagar');
    let target = wompiOrder;
    if (target && target.key !== orderKey) {
      await discardStaleOrder(target.id);
      target = null;
    }
    if (!target) {
      const order = await createOrderFromCart();
      target = { id: Number(order.id), orderNumber: order.orderNumber, key: orderKey };
      setWompiOrder(target);
    }
    return ordersService.wompiCheckout(target.id);
  };

  // 3) El widget terminó: el backend consulta la transacción en Wompi y marca el pedido
  // como pagado si el monto coincide (el webhook también lo confirma).
  const handleWompiResult = async (transactionId: string, reference: string) => {
    setIsSubmitting(true);
    try {
      const { order } = await ordersService.confirmWompiPayment(reference, transactionId);
      clearCart();
      showToast(String(order?.status ?? '').toUpperCase() === 'PAID' ? '¡Pago exitoso! Tu pedido está confirmado.' : 'Recibimos tu pago; lo estamos verificando.', 'success');
      navigate('/my-orders');
    } catch (error: unknown) {
      // El pago puede seguir pendiente en Wompi: el pedido queda creado y el webhook lo confirmará.
      clearCart();
      showToast(error instanceof Error ? error.message : 'Tu pago está en verificación.', 'info');
      navigate('/my-orders');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWompiError = (error: string) => {
    showToast(error, 'error');
  };

  const handleWompiClose = () => {
    showToast('Pago cancelado', 'info');
  };

  // Handler para métodos de pago manuales (transferencia, contra entrega)
  const handleManualPayment = async () => {
    if (!validateForm()) {
      showToast('Por favor completa todos los campos requeridos', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // Crear pedido pendiente
      const order = await createOrderFromCart();

      // Crear registro de pago PENDIENTE para verificación manual
      const payment = await createPayment({
        orderId: Number(order.id),
        transactionId: paymentReference, // Usar referencia generada
        paymentMethod: selectedMethod?.type || 'transfer',
        amount: orderTotal,
        currency: settings.general.currency || 'COP',
        payerName: formData.customerName,
        payerEmail: formData.customerEmail,
        payerPhone: formData.customerPhone,
      });

      // Adjuntar el comprobante si el cliente subió uno.
      if (proofImage && payment?.id) {
        try {
          await updateMyPayment(payment.id, { receiptData: proofImage });
        } catch {
          // No bloquea el pedido: el cliente puede subirlo luego desde "Mis pedidos".
        }
      }

      clearCart();

      showToast(
        proofImage
          ? '¡Pedido creado! Verificaremos tu comprobante pronto.'
          : '¡Pedido creado! Te contactaremos pronto.',
        'success'
      );

      // Redirigir a mis pedidos
      navigate('/my-orders');
    } catch (error: any) {
      const errorMessage = error?.message || 'Error al procesar el pedido. Intenta de nuevo.';
      showToast(errorMessage, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler para Mercado Pago (Checkout Pro): crea el pedido, registra el pago
  // pendiente y redirige a la pasarela para pagar.
  const handleMercadoPago = async () => {
    if (!validateForm()) {
      showToast('Por favor completa todos los campos requeridos', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      let current = mpOrder;
      if (current && current.key !== orderKey) {
        await discardStaleOrder(current.id);
        current = null;
      }
      if (!current) {
        const order = await createOrderFromCart();
        current = { id: Number(order.id), key: orderKey, paymentCreated: false };
        setMpOrder(current);
      }
      const orderId = current.id;
      // El registro del pago se crea una sola vez, pero se reintenta si falló antes.
      if (!current.paymentCreated) {
        await createPayment({
          orderId,
          paymentMethod: 'mercadopago',
          amount: orderTotal,
          currency: settings.general.currency || 'COP',
          payerName: formData.customerName,
          payerEmail: formData.customerEmail,
          payerPhone: formData.customerPhone,
        });
        setMpOrder({ ...current, paymentCreated: true });
      }

      const pref = await paymentsService.createMercadoPagoPreference(orderId);
      if (!pref.initPoint) {
        throw new Error('No se obtuvo la URL de pago de Mercado Pago');
      }

      clearCart();
      // Redirige a la pasarela de Mercado Pago.
      window.location.href = pref.initPoint;
    } catch (error: any) {
      const errorMessage = error?.message || 'No se pudo iniciar el pago con Mercado Pago.';
      showToast(errorMessage, 'error');
      setIsSubmitting(false);
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
  ];

  const canProceedToPayment = formData.customerName && formData.customerEmail && formData.customerPhone && formData.shippingAddress && formData.shippingCity;

  if (cart.items.length === 0) {
    return null;
  }

  // Convertir total a centavos para Wompi
  const amountInCents = Math.round(orderTotal * 100);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Encabezado de la tienda (gradiente de marca) */}
      <PageHeader
        title="Finalizar compra"
        subtitle={step === 'info' ? 'Completa tu información' : 'Selecciona método de pago'}
        backLabel="Carrito"
        backTo="/cart"
      />

      <div className="max-w-7xl mx-auto px-4 py-6 lg:py-8">
        {/* Pasos */}
        <ol className="flex items-center gap-2 sm:gap-3 mb-6">
          {steps.map((s, index) => {
            const isActive = step === s.id;
            const isCompleted = steps.findIndex((x) => x.id === step) > index;
            return (
              <li key={s.id} className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (s.id === 'info') setStep('info');
                    else if (s.id === 'payment' && canProceedToPayment) setStep('payment');
                  }}
                  className={`inline-flex items-center gap-2 h-9 pl-1.5 pr-3 rounded-full border text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-app-300 bg-app-50 text-app-700'
                      : isCompleted
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-white text-gray-500'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                    isActive ? 'bg-app-600 text-white' : isCompleted ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
                  </span>
                  {s.label}
                </button>
                {index < steps.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300" />}
              </li>
            );
          })}
        </ol>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
          {/* Contenido */}
          <div className="lg:col-span-2 space-y-5">
            {/* Paso 1: datos del cliente y envío */}
            {step === 'info' && (
              <>
                <Card>
                  <CardTitle icon={User}>Información del cliente</CardTitle>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Nombre completo" required error={errors.customerName} className="md:col-span-2">
                      <TextInput
                        name="customerName"
                        value={formData.customerName}
                        onChange={handleInputChange}
                        error={!!errors.customerName}
                        placeholder="Juan Pérez"
                        autoComplete="name"
                      />
                    </Field>
                    <Field label="Correo electrónico" required error={errors.customerEmail}>
                      <TextInput
                        name="customerEmail"
                        type="email"
                        value={formData.customerEmail}
                        onChange={handleInputChange}
                        error={!!errors.customerEmail}
                        placeholder="correo@ejemplo.com"
                        autoComplete="email"
                      />
                    </Field>
                    <Field label="Teléfono" required error={errors.customerPhone}>
                      <TextInput
                        name="customerPhone"
                        type="tel"
                        value={formData.customerPhone}
                        onChange={handleInputChange}
                        error={!!errors.customerPhone}
                        placeholder="300 123 4567"
                        autoComplete="tel"
                      />
                    </Field>
                  </div>
                </Card>

                <Card>
                  <CardTitle icon={MapPin}>Dirección de envío</CardTitle>

                  {/* Direcciones guardadas */}
                  {savedAddresses.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      {savedAddresses.map((a) => {
                        const isSelected = selectedAddressId === a.id;
                        return (
                          <button
                            type="button"
                            key={a.id}
                            onClick={() => selectSavedAddress(a)}
                            className={`${choiceClass(isSelected)} p-3`}
                          >
                            <Home className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isSelected ? 'text-app-600' : 'text-gray-400'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-gray-900">{a.label}</p>
                                {a.isDefault && <Badge tone="app">Predeterminada</Badge>}
                              </div>
                              <p className="text-sm text-gray-600 mt-0.5 truncate">{a.address}</p>
                              <p className="text-xs text-gray-500">
                                {a.city}
                                {a.postalCode && `, ${a.postalCode}`}
                              </p>
                            </div>
                            <RadioDot checked={isSelected} />
                          </button>
                        );
                      })}

                      <button type="button" onClick={selectNewAddress} className={`${choiceClass(selectedAddressId === 'new')} p-3 items-center`}>
                        <Edit3 className={`w-5 h-5 flex-shrink-0 ${selectedAddressId === 'new' ? 'text-app-600' : 'text-gray-400'}`} />
                        <span className="flex-1 text-sm font-medium text-gray-900">Usar otra dirección</span>
                        <RadioDot checked={selectedAddressId === 'new'} />
                      </button>
                    </div>
                  )}

                  {/* Dirección nueva */}
                  {selectedAddressId === 'new' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <Field label="Dirección completa" required error={errors.shippingAddress} className="md:col-span-2">
                        <TextInput
                          name="shippingAddress"
                          value={formData.shippingAddress}
                          onChange={handleInputChange}
                          error={!!errors.shippingAddress}
                          placeholder="Calle 123 #45-67, Apto 301"
                          autoComplete="street-address"
                        />
                      </Field>
                      <div className="md:col-span-2">
                        <CitySelect
                          city={formData.shippingCity}
                          onChange={(city) => {
                            setFormData((prev) => ({ ...prev, shippingCity: city }));
                            setErrors((prev) => ({ ...prev, shippingCity: undefined }));
                          }}
                          error={errors.shippingCity}
                          required
                        />
                      </div>
                      <Field label="Código postal">
                        <TextInput
                          name="shippingPostalCode"
                          value={formData.shippingPostalCode}
                          onChange={handleInputChange}
                          placeholder="110111"
                          autoComplete="postal-code"
                        />
                      </Field>
                    </div>
                  )}

                  <Field label="Notas de entrega" hint="Opcional: indicaciones para el repartidor.">
                    <TextArea
                      name="shippingNotes"
                      value={formData.shippingNotes}
                      onChange={handleInputChange}
                      rows={3}
                      placeholder="Edificio azul, portería 24h, timbre..."
                    />
                  </Field>

                  <div className="pt-5 mt-5 border-t border-gray-100 flex justify-end">
                    <Button
                      size="lg"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        if (validateForm()) {
                          setStep('payment');
                        }
                      }}
                      disabled={!canProceedToPayment}
                    >
                      Continuar al pago
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              </>
            )}

            {/* Paso 2: pago */}
            {step === 'payment' && (
              <>
                {/* Resumen del cliente */}
                <Card>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{formData.customerName}</p>
                        <p className="text-sm text-gray-500 truncate">{formData.shippingAddress}, {formData.shippingCity}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" icon={<Edit3 className="w-4 h-4" />} onClick={() => setStep('info')}>
                      Editar
                    </Button>
                  </div>
                </Card>

                {/* Método de pago */}
                {activePaymentMethods.length > 0 && (
                  <Card>
                    <CardTitle icon={CreditCard}>Método de pago</CardTitle>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activePaymentMethods.map((method) => {
                        const isSelected = selectedPaymentMethod === method.id;
                        return (
                          <button
                            type="button"
                            key={method.id}
                            onClick={() => setSelectedPaymentMethod(method.id)}
                            className={`${choiceClass(isSelected)} p-3 items-center`}
                          >
                            <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 [&>svg]:w-5 [&>svg]:h-5 ${
                              isSelected ? 'bg-app-100 text-app-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {getPaymentIcon(method.type)}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-medium text-gray-900">{method.name}</span>
                              {method.description && <span className="block text-xs text-gray-500 line-clamp-2">{method.description}</span>}
                            </span>
                            <RadioDot checked={isSelected} />
                          </button>
                        );
                      })}
                    </div>

                    {/* Área de pago según método seleccionado */}
                    {selectedMethod?.type === 'wompi' && wompiConfig && (
                      <div className="border-t border-gray-100 pt-5 mt-5">
                        <WompiCheckout
                          publicKey={wompiConfig.publicKey}
                          amountInCents={amountInCents}
                          customerEmail={formData.customerEmail}
                          customerFullName={formData.customerName}
                          customerPhone={formData.customerPhone}
                          prepare={handleWompiPrepare}
                          onPaymentResult={handleWompiResult}
                          onPaymentError={handleWompiError}
                          onClose={handleWompiClose}
                        />
                      </div>
                    )}

                    {/* Transferencia bancaria */}
                    {selectedMethod?.type === 'transfer' && (
                      <div className="border-t border-gray-100 pt-5 mt-5 space-y-4">
                        {selectedMethod.bankInfo && (
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                            <p className="text-sm font-medium text-gray-900 mb-3">Datos para transferencia</p>
                            <DescriptionList
                              items={[
                                { label: 'Banco', value: selectedMethod.bankInfo.bankName },
                                { label: 'Tipo de cuenta', value: selectedMethod.bankInfo.accountType },
                                { label: 'Número', value: selectedMethod.bankInfo.accountNumber },
                                { label: 'Titular', value: selectedMethod.bankInfo.accountHolder },
                                { label: selectedMethod.bankInfo.documentType, value: selectedMethod.bankInfo.documentNumber },
                              ]}
                            />
                          </div>
                        )}
                        {selectedMethod.instructions && <Alert tone="warning">{selectedMethod.instructions}</Alert>}
                        {selectedMethod.requireProof && renderProofUploader()}
                        <Button size="lg" fullWidth onClick={handleManualPayment} isLoading={isSubmitting} icon={<CheckCircle2 className="w-5 h-5" />}>
                          Confirmar pedido · {formatCurrency(orderTotal)}
                        </Button>
                      </div>
                    )}

                    {/* Nequi */}
                    {selectedMethod?.type === 'nequi' && (
                      <div className="border-t border-gray-100 pt-5 mt-5 space-y-4">
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
                          <div className="flex-1">
                            <p className="text-sm text-gray-500 flex items-center gap-2">
                              <Smartphone className="w-4 h-4" />
                              Paga con Nequi a
                            </p>
                            <p className="text-xl font-bold text-gray-900 mt-1">{selectedMethod.nequiConfig?.phone || '—'}</p>
                            {selectedMethod.nequiConfig?.accountHolder && (
                              <p className="text-sm text-gray-600 mt-0.5">Titular: {selectedMethod.nequiConfig.accountHolder}</p>
                            )}
                          </div>
                          {selectedMethod.nequiConfig?.qrImage && (
                            <img
                              src={selectedMethod.nequiConfig.qrImage}
                              alt="QR Nequi"
                              className="w-36 h-36 object-contain rounded-lg border border-gray-200 bg-white"
                            />
                          )}
                        </div>
                        {selectedMethod.instructions && <Alert tone="warning">{selectedMethod.instructions}</Alert>}
                        {selectedMethod.requireProof && renderProofUploader()}
                        <Button size="lg" fullWidth onClick={handleManualPayment} isLoading={isSubmitting} icon={<CheckCircle2 className="w-5 h-5" />}>
                          Confirmar pedido · {formatCurrency(orderTotal)}
                        </Button>
                      </div>
                    )}

                    {/* Mercado Pago (Checkout Pro): conserva el color propio de Mercado Pago */}
                    {selectedMethod?.type === 'mercadopago' && (
                      <div className="border-t border-gray-100 pt-5 mt-5 space-y-3">
                        {selectedMethod.instructions && <Alert tone="info">{selectedMethod.instructions}</Alert>}
                        <Button
                          size="lg"
                          fullWidth
                          onClick={handleMercadoPago}
                          isLoading={isSubmitting}
                          icon={<Wallet className="w-5 h-5" />}
                          className="!bg-[#009ee3] hover:!bg-[#008fcc]"
                        >
                          Pagar con Mercado Pago · {formatCurrency(orderTotal)}
                        </Button>
                        <p className="text-xs text-gray-500 text-center">
                          Serás redirigido a Mercado Pago para completar el pago de forma segura.
                        </p>
                      </div>
                    )}

                    {/* Contra entrega */}
                    {selectedMethod?.type === 'cash' && (
                      <div className="border-t border-gray-100 pt-5 mt-5 space-y-3">
                        {selectedMethod.instructions && <Alert tone="warning">{selectedMethod.instructions}</Alert>}
                        <Button size="lg" fullWidth onClick={handleManualPayment} isLoading={isSubmitting} icon={<Banknote className="w-5 h-5" />}>
                          Confirmar pedido · {formatCurrency(orderTotal)}
                        </Button>
                        <p className="text-xs text-gray-500 text-center">
                          Pagarás {formatCurrency(orderTotal)} al momento de recibir tu pedido
                        </p>
                      </div>
                    )}

                    {/* Recoger en punto físico */}
                    {selectedMethod?.type === 'pickup' && (
                      <div className="border-t border-gray-100 pt-5 mt-5 space-y-4">
                        {selectedMethod.pickupConfig && (
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 flex items-start gap-3">
                            <Store className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-gray-900">{selectedMethod.pickupConfig.storeName}</h4>
                              <div className="mt-2 space-y-1.5 text-sm text-gray-600">
                                <p className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-gray-400" />
                                  {selectedMethod.pickupConfig.address}, {selectedMethod.pickupConfig.city}
                                </p>
                                <p className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-gray-400" />
                                  {selectedMethod.pickupConfig.scheduleWeekdays}
                                </p>
                                {selectedMethod.pickupConfig.scheduleWeekends && (
                                  <p className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    {selectedMethod.pickupConfig.scheduleWeekends}
                                  </p>
                                )}
                                {selectedMethod.pickupConfig.phone && (
                                  <p className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-gray-400" />
                                    {selectedMethod.pickupConfig.phone}
                                  </p>
                                )}
                              </div>
                              {selectedMethod.pickupConfig.mapUrl && (
                                <a
                                  href={selectedMethod.pickupConfig.mapUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 mt-3 text-sm text-app-700 hover:underline font-medium"
                                >
                                  <MapPin className="w-4 h-4" />
                                  Ver en Google Maps
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                        {selectedMethod.instructions && <Alert tone="info">{selectedMethod.instructions}</Alert>}
                        {selectedMethod.requireProof && renderProofUploader()}
                        <Button size="lg" fullWidth onClick={handleManualPayment} isLoading={isSubmitting} icon={<Store className="w-5 h-5" />}>
                          Reservar para recoger · {formatCurrency(orderTotal)}
                        </Button>
                        <p className="text-xs text-gray-500 text-center">
                          Pagarás {formatCurrency(orderTotal)} al recoger tu pedido en tienda
                        </p>
                      </div>
                    )}
                  </Card>
                )}

                {activePaymentMethods.length === 0 && (
                  <Card padded={false}>
                    <EmptyState icon={CreditCard} title="No hay métodos de pago disponibles" description="Intenta de nuevo más tarde o contáctanos." />
                  </Card>
                )}

                <Button variant="secondary" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => setStep('info')}>
                  Volver
                </Button>
              </>
            )}
          </div>

          {/* Resumen del pedido */}
          <aside className="lg:col-span-1 lg:sticky lg:top-24">
            <Card>
              <CardTitle actions={<Badge>{cart.totalItems} {cart.totalItems === 1 ? 'artículo' : 'artículos'}</Badge>}>
                Resumen del pedido
              </CardTitle>

              <ul className="divide-y divide-gray-100 -mt-1 mb-4 max-h-64 overflow-y-auto">
                {cart.items.map((item) => {
                  const isCustomized = item.type === 'customized';
                  let name: string;
                  let image: string;
                  let color: string;
                  let colorHex: string;
                  let size: string;

                  if (isCustomized) {
                    const customized = item.customizedProduct;
                    name = customized.productName;
                    image = customized.previewImages.front;
                    color = customized.selectedColorName || 'Personalizado';
                    colorHex = customized.selectedColor;
                    size = customized.selectedSize;
                  } else {
                    const standardItem = item as import('../types/cart').CartItem;
                    name = standardItem.product.name;
                    image = standardItem.product.colors?.find((c) => c.hexCode === standardItem.selectedColor)?.image || standardItem.product.images.front;
                    colorHex = standardItem.selectedColor;
                    // Buscar nombre del color en el producto
                    const colorObj = standardItem.product.colors.find(c => c.hexCode === standardItem.selectedColor);
                    color = colorObj?.name || standardItem.selectedColor;
                    size = standardItem.selectedSize;
                  }

                  return (
                    <li key={item.id} className="flex gap-3 py-2.5">
                      <div className="relative flex-shrink-0">
                        <img src={image} alt={name} className="w-12 h-12 object-cover rounded-lg border border-gray-200 bg-gray-50" />
                        <span className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-gray-700 text-white text-[11px] font-semibold flex items-center justify-center">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                        {(colorHex || size) && (
                          <p className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                            {colorHex && (
                              <span className="w-3 h-3 rounded-full ring-1 ring-gray-300" style={{ backgroundColor: colorHex }} title={color} />
                            )}
                            {colorHex && <span className="truncate">{color}</span>}
                            {colorHex && size && <span className="text-gray-300">·</span>}
                            {size && <span>Talla {size}</span>}
                          </p>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 whitespace-nowrap">{formatCurrency(item.subtotal)}</p>
                    </li>
                  );
                })}
              </ul>

              {/* Cupón */}
              <div className="mb-4">
                {coupon ? (
                  <div className="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                    <span className="text-xs font-semibold text-green-700 flex items-center gap-1.5">
                      <Ticket className="w-3.5 h-3.5" /> {coupon.code}
                    </span>
                    <button type="button" onClick={removeCoupon} className="text-xs text-green-700 hover:text-green-900 underline">Quitar</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <TextInput
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }}
                      placeholder="Código de cupón"
                      className="flex-1 min-w-0 uppercase placeholder:normal-case"
                      error={!!couponError}
                    />
                    <Button variant="secondary" onClick={applyCoupon} isLoading={couponBusy} disabled={!couponInput.trim()}>
                      Aplicar
                    </Button>
                  </div>
                )}
                {couponError && <p className="text-xs text-red-600 mt-1">{couponError}</p>}
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium text-gray-900">{formatCurrency(cart.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Impuestos</span>
                  <span className="font-medium text-gray-900">{formatCurrency(cart.tax)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Envío</span>
                  <span className={`font-medium ${shippingCost === 0 ? 'text-green-700' : 'text-gray-900'}`}>
                    {shippingCost === 0 ? 'Gratis' : formatCurrency(shippingCost)}
                  </span>
                </div>
                {shippingQuote && (
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                      <Clock className="w-4 h-4 text-gray-500" />
                      Llega en {handlingDays + shippingQuote.estimatedDays.min}–{handlingDays + shippingQuote.estimatedDays.max} días hábiles
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 pl-5">
                      {shippingQuote.carrierName} · {shippingQuote.zoneName}
                      {handlingDays > 0 && ` · ${handlingDays} ${handlingDays === 1 ? 'día' : 'días'} de preparación + ${shippingQuote.estimatedDays.min}–${shippingQuote.estimatedDays.max} de envío`}
                    </p>
                  </div>
                )}
                {!shippingQuote && formData.shippingCity.trim() !== '' && (
                  <p className="text-xs text-amber-700">
                    {handlingDays > 0 && <>Preparación {handlingDays} {handlingDays === 1 ? 'día' : 'días'}. </>}
                    Tarifa estimada — "{formData.shippingCity}" aún no está en una zona de cobertura
                  </p>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Descuento{coupon ? ` (${coupon.code})` : ''}</span>
                    <span className="font-medium">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4 mt-4 flex items-baseline justify-between">
                <span className="text-base font-semibold text-gray-900">Total</span>
                <span className="text-xl font-bold text-gray-900">{formatCurrency(orderTotal)}</span>
              </div>

              <ul className="mt-4 pt-4 border-t border-gray-100 space-y-1.5 text-xs text-gray-500">
                <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-gray-400" />Pago 100% seguro</li>
                <li className="flex items-center gap-2"><Truck className="w-4 h-4 text-gray-400" />Envío con seguimiento</li>
              </ul>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
};

/** Clase de las tarjetas seleccionables (direcciones y métodos de pago). */
const choiceClass = (selected: boolean) =>
  `w-full flex items-start gap-3 rounded-lg border text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500 ${
    selected ? 'border-app-500 bg-app-50 ring-1 ring-app-500' : 'border-gray-200 bg-white hover:border-gray-300'
  }`;

/** Indicador de radio de las tarjetas seleccionables. */
function RadioDot({ checked }: { checked: boolean }) {
  return (
    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${checked ? 'border-app-600 bg-app-600' : 'border-gray-300 bg-white'}`}>
      {checked && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
    </span>
  );
}
