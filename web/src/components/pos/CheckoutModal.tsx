import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle,
  Printer,
  Download,
  Mail,
  X,
  Loader2,
  ArrowRight,
  Search,
  User,
  Building2,
  Phone,
  CreditCard,
  Hash,
  MessageCircle,
} from 'lucide-react';
import * as posService from '../../services/pos.service';
import type { CustomerSearchResult } from '../../services/pos.service';
import type { SelectedCustomer } from './CustomerSelect';

type CheckoutStep = 'customer' | 'processing' | 'completed';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customerData: {
    customerId?: number;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    customerNit?: string;
    // Card payment data:
    cardReference?: string;
    cardType?: string;
    cardLastFour?: string;
  }) => Promise<{
    sale: {
      id: number;
      orderNumber: string;
    };
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    change: number;
    paymentMethod: 'cash' | 'card' | 'transfer' | 'mixed' | 'debe';
  }>;
  total: number;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'mixed' | 'debe';
  initialCustomer?: SelectedCustomer | null;
  abono?: number;
  taxRate?: number;
}

export const CheckoutModal = ({
  isOpen,
  onClose,
  onConfirm,
  total,
  paymentMethod,
  initialCustomer,
  abono = 0,
  taxRate = 19,
}: CheckoutModalProps) => {
  const [step, setStep] = useState<CheckoutStep>('customer');

  // Customer data
  const [nitInput, setNitInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [customerFound, setCustomerFound] = useState<CustomerSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  // Autocompletar por nombre
  const [nameResults, setNameResults] = useState<CustomerSearchResult[]>([]);
  const [showNameResults, setShowNameResults] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const isDebt = paymentMethod === 'debe';
  const [sendInvoiceEmail, setSendInvoiceEmail] = useState(false);

  // Card payment data
  const [cardReference, setCardReference] = useState('');
  const [cardType, setCardType] = useState('');
  const [cardLastFour, setCardLastFour] = useState('');

  // Completed sale data
  const [completedData, setCompletedData] = useState<{
    sale: { id: number; orderNumber: string };
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    change: number;
    paymentMethod: 'cash' | 'card' | 'transfer' | 'mixed' | 'debe';
  } | null>(null);

  // PDF preview
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const nitInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('customer');
      // Pre-rellenar con el cliente elegido en la pantalla de venta (si hay).
      setNitInput(initialCustomer?.cedula || '');
      setNameInput(initialCustomer?.name || '');
      setEmailInput(initialCustomer?.email || '');
      setPhoneInput(initialCustomer?.phone || '');
      setCustomerFound(
        initialCustomer?.id
          ? {
              id: initialCustomer.id,
              name: initialCustomer.name,
              email: initialCustomer.email ?? null,
              phone: initialCustomer.phone ?? null,
              cedula: initialCustomer.cedula ?? '',
              totalPurchases: 0,
              totalSpent: 0,
            }
          : null
      );
      setCompletedData(null);
      setPdfUrl(null);
      setEmailSent(false);
      setSendInvoiceEmail(!!initialCustomer?.email);
      setEditingCustomer(false);
      // Reset card data
      setCardReference('');
      setCardType('');
      setCardLastFour('');

      // Focus NIT input after a short delay
      setTimeout(() => nitInputRef.current?.focus(), 100);
    }

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [isOpen]);

  // Search customer by NIT/cédula
  const handleSearchCustomer = async () => {
    if (!nitInput.trim()) {
      setCustomerFound(null);
      return;
    }

    setIsSearching(true);
    try {
      const customer = await posService.searchCustomerByCedula(nitInput.trim());
      setCustomerFound(customer);
      if (customer) {
        setNameInput(customer.name);
        setEmailInput(customer.email);
        setPhoneInput(customer.phone || '');
        setSendInvoiceEmail(!!customer.email);
      }
    } catch (error) {
      console.error('Error searching customer:', error);
      setCustomerFound(null);
    } finally {
      setIsSearching(false);
    }
  };

  // Buscar clientes por nombre (autocompletar)
  const handleNameChange = async (value: string) => {
    setNameInput(value);
    setCustomerFound(null); // al editar el nombre se deselecciona el cliente
    if (value.trim().length < 2) {
      setNameResults([]);
      setShowNameResults(false);
      return;
    }
    try {
      const results = await posService.searchCustomers(value.trim());
      setNameResults(results);
      setShowNameResults(results.length > 0);
    } catch {
      setNameResults([]);
      setShowNameResults(false);
    }
  };

  const handleSelectCustomer = (c: CustomerSearchResult) => {
    setCustomerFound(c);
    setNameInput(c.name);
    setEmailInput(c.email || '');
    setPhoneInput(c.phone || '');
    setNitInput(c.cedula || '');
    setSendInvoiceEmail(!!c.email);
    setShowNameResults(false);
  };

  // Load PDF after sale is completed
  const loadPdf = async (saleId: number) => {
    try {
      setLoadingPdf(true);
      const blob = await posService.getInvoicePDFBlob(saleId);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (error) {
      console.error('Error loading PDF:', error);
    } finally {
      setLoadingPdf(false);
    }
  };

  // Process the sale
  const handleConfirmSale = async () => {
    // Validate card reference for card/mixed payments
    if ((paymentMethod === 'card' || paymentMethod === 'transfer' || paymentMethod === 'mixed') && !cardReference.trim()) {
      // Card reference is optional but recommended
      // You can make it required by uncommenting the next lines:
      // alert('Por favor ingrese la referencia del pago con tarjeta');
      // return;
    }

    // Fiado: exige cliente identificado (seleccionado o por nombre).
    if (isDebt && !customerFound && !nameInput.trim()) {
      alert('Para una venta a crédito (Debe) debes seleccionar o registrar un cliente.');
      return;
    }

    setStep('processing');

    try {
      const result = await onConfirm({
        customerId: customerFound?.id,
        customerName: nameInput.trim() || undefined,
        customerEmail: sendInvoiceEmail && emailInput.trim() ? emailInput.trim() : undefined,
        customerPhone: phoneInput.trim() || undefined,
        customerNit: nitInput.trim() || undefined,
        // Card payment data:
        cardReference: cardReference.trim() || undefined,
        cardType: cardType || undefined,
        cardLastFour: cardLastFour.trim() || undefined,
      });

      setCompletedData(result);
      setStep('completed');

      // Load PDF in background
      loadPdf(result.sale.id);

      // If email was provided, it was already sent by the parent
      if (sendInvoiceEmail && emailInput.trim()) {
        setEmailSent(true);
      }
    } catch (error) {
      console.error('Error processing sale:', error);
      // Go back to customer step on error
      setStep('customer');
    }
  };

  const handlePrint = async () => {
    if (!completedData) return;
    setPrinting(true);
    try {
      await posService.printInvoicePDF(completedData.sale.id);
    } catch (error) {
      console.error('Error printing:', error);
    } finally {
      setPrinting(false);
    }
  };

  const handleDownload = () => {
    if (!pdfUrl || !completedData) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `Recibo_${completedData.sale.orderNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Enviar el recibo por WhatsApp (mensaje de texto).
  const handleWhatsApp = async () => {
    if (!completedData) return;
    let text = `*Recibo ${completedData.sale.orderNumber}*\n`;
    try {
      const detail = await posService.getSaleDetail(completedData.sale.id);
      (detail.items || []).forEach((it: any) => {
        const name = it.productName || it.product?.name || 'Producto';
        const qty = it.quantity || 1;
        const sub = (it.unitPrice || 0) * qty;
        text += `${qty} x ${name} — $${sub.toLocaleString()}\n`;
      });
    } catch {
      /* si falla, va sin el detalle de items */
    }
    text += `\nTotal: $${completedData.total.toLocaleString()}`;
    if (isDebt) {
      text += `\nAbonó: $${abono.toLocaleString()}\nQueda debiendo: $${Math.max(0, completedData.total - abono).toLocaleString()}`;
    }
    text += `\n\n¡Gracias por tu compra!`;

    // Teléfono del cliente si existe (Colombia: anteponer 57 a 10 dígitos).
    const raw = (phoneInput || initialCustomer?.phone || '').replace(/\D/g, '');
    const phone = raw.length === 10 ? `57${raw}` : raw;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleSendEmail = async () => {
    if (!emailInput.trim() || !completedData) return;
    setSendingEmail(true);
    try {
      await posService.sendInvoiceEmail(completedData.sale.id, emailInput.trim());
      setEmailSent(true);
    } catch (error) {
      console.error('Error sending email:', error);
    } finally {
      setSendingEmail(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] mx-4 flex flex-col overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 ${
          step === 'completed'
            ? 'bg-gradient-to-r from-green-500 to-green-600'
            : step === 'processing'
            ? 'bg-gradient-to-r from-blue-500 to-blue-600'
            : 'bg-gradient-to-r from-orange-500 to-orange-600'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-full p-2">
                {step === 'completed' ? (
                  <CheckCircle className="w-6 h-6 text-white" />
                ) : step === 'processing' ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <User className="w-6 h-6 text-white" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {step === 'completed'
                    ? 'Venta Exitosa'
                    : step === 'processing'
                    ? 'Procesando Venta...'
                    : 'Datos del Recibo'}
                </h2>
                <p className="text-white/80 text-sm">
                  {step === 'completed' && completedData
                    ? `Recibo #${completedData.sale.orderNumber}`
                    : step === 'processing'
                    ? 'Por favor espere...'
                    : 'Opcional - para personalizar el recibo'}
                </p>
              </div>
            </div>
            {step !== 'processing' && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* STEP: Customer Data */}
          {step === 'customer' && (
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="max-w-lg mx-auto space-y-6">
                {isDebt && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    <strong>Venta a crédito (Debe).</strong> Selecciona o registra el cliente que queda debiendo. Se cobra después desde "Fiados".
                  </div>
                )}
                {/* Cliente ya elegido en la pantalla de venta */}
                {initialCustomer && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <User className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{initialCustomer.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {initialCustomer.cedula
                            ? `CC/NIT ${initialCustomer.cedula}`
                            : initialCustomer.id
                            ? 'Cliente existente'
                            : 'Cliente nuevo · se registra al cobrar'}
                          {initialCustomer.phone ? ` · ${initialCustomer.phone}` : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingCustomer((v) => !v)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 flex-shrink-0"
                    >
                      {editingCustomer ? 'Listo' : 'Editar'}
                    </button>
                  </div>
                )}

                {/* NIT/Cédula Search (solo si no se eligió cliente en la venta) */}
                {!initialCustomer && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cédula / NIT del Cliente
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        ref={nitInputRef}
                        type="text"
                        value={nitInput}
                        onChange={(e) => setNitInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchCustomer()}
                        placeholder="Ingrese cédula o NIT"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={handleSearchCustomer}
                      disabled={isSearching || !nitInput.trim()}
                      className="px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2 transition-colors"
                    >
                      {isSearching ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Search className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {customerFound && (
                    <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Cliente encontrado - datos cargados
                    </p>
                  )}
                  {nitInput.trim() && !isSearching && !customerFound && (
                    <p className="mt-2 text-sm text-gray-500">
                      Cliente nuevo - complete los datos si lo desea
                    </p>
                  )}
                </div>
                )}

                {/* Customer Name (con autocompletar por nombre) */}
                {!initialCustomer && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre / Razón Social {isDebt && <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => handleNameChange(e.target.value)}
                      onFocus={() => nameResults.length > 0 && setShowNameResults(true)}
                      placeholder="Escribe para buscar o registrar un cliente"
                      autoComplete="off"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    {showNameResults && nameResults.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                        {nameResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectCustomer(c)}
                            className="w-full text-left px-4 py-2 hover:bg-orange-50 border-b last:border-b-0"
                          >
                            <p className="text-sm font-medium text-gray-900">{c.name}</p>
                            <p className="text-xs text-gray-500">
                              {c.cedula ? `CC/NIT ${c.cedula}` : 'Sin cédula'}
                              {c.phone ? ` · ${c.phone}` : ''}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {customerFound && (
                    <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Cliente seleccionado
                    </p>
                  )}
                </div>
                )}

                {/* Phone */}
                {(!initialCustomer || editingCustomer) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teléfono
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="Teléfono de contacto"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>
                )}

                {/* Email */}
                {(!initialCustomer || editingCustomer) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email para el recibo
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => {
                        setEmailInput(e.target.value);
                        if (e.target.value.trim()) {
                          setSendInvoiceEmail(true);
                        }
                      }}
                      placeholder="cliente@email.com"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  {emailInput.trim() && (
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sendInvoiceEmail}
                        onChange={(e) => setSendInvoiceEmail(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-600">Enviar recibo por email</span>
                    </label>
                  )}
                </div>
                )}

                {/* Transaction Details - Only for card, transfer or mixed */}
                {(paymentMethod === 'card' || paymentMethod === 'transfer' || paymentMethod === 'mixed') && (
                  <div className="bg-blue-50 rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-blue-800">
                        Datos de la Transacción
                      </span>
                    </div>

                    {/* Card Reference */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Referencia / Autorización
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="text"
                          value={cardReference}
                          onChange={(e) => setCardReference(e.target.value)}
                          placeholder="Número de autorización del datafono"
                          className="w-full pl-10 pr-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Transaction Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tipo de Transacción
                        </label>
                        <select
                          value={cardType}
                          onChange={(e) => setCardType(e.target.value)}
                          className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="">Seleccionar...</option>
                          <option value="nequi">Nequi</option>
                          <option value="bancolombia">Bancolombia</option>
                          <option value="daviplata">Daviplata</option>
                          <option value="pse">PSE</option>
                          <option value="efecty">Efecty</option>
                          <option value="dale">Dale!</option>
                          <option value="visa">Visa</option>
                          <option value="mastercard">Mastercard</option>
                          <option value="amex">American Express</option>
                          <option value="datafono">Datáfono</option>
                          <option value="otro">Otro</option>
                        </select>
                      </div>

                      {/* Last 4 Digits / Phone */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Últimos 4 dígitos / Celular
                        </label>
                        <input
                          type="text"
                          value={cardLastFour}
                          onChange={(e) => {
                            // Only allow digits, max 10
                            const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setCardLastFour(value);
                          }}
                          placeholder="1234 o 3001234567"
                          maxLength={10}
                          className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-blue-600">
                      * Estos datos ayudan a rastrear las transacciones digitales
                    </p>
                  </div>
                )}

                {/* Payment Summary */}
                <div className="bg-gray-50 rounded-lg p-4 mt-6">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total a cobrar:</span>
                    <span className="text-2xl font-bold text-gray-900">
                      ${total.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-sm">
                    <span className="text-gray-500">Método de pago:</span>
                    <span className="font-medium text-gray-700">
                      {paymentMethod === 'cash' ? 'Efectivo' :
                       paymentMethod === 'card' ? 'Tarjeta' :
                       paymentMethod === 'transfer' ? 'Transferencia' :
                       paymentMethod === 'debe' ? 'Debe (fiado)' : 'Mixto'}
                    </span>
                  </div>
                  {isDebt && abono > 0 && (
                    <>
                      <div className="flex justify-between items-center mt-2 text-sm">
                        <span className="text-gray-500">Abono ahora:</span>
                        <span className="font-medium text-green-700">${abono.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1 text-sm">
                        <span className="text-gray-500">Queda debiendo:</span>
                        <span className="font-bold text-amber-700">
                          ${Math.max(0, total - abono).toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmSale}
                    disabled={isDebt && !customerFound && !nameInput.trim()}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <CheckCircle className="w-5 h-5" />
                    {isDebt ? 'Registrar Fiado' : 'Confirmar Venta'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP: Processing */}
          {step === 'processing' && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Procesando venta...
                </h3>
                <p className="text-gray-600">
                  Por favor espere mientras se registra la transacción
                </p>
              </div>
            </div>
          )}

          {/* STEP: Completed */}
          {step === 'completed' && completedData && (
            <>
              {/* Left Panel - Summary and Actions */}
              <div className="lg:w-80 border-b lg:border-b-0 lg:border-r border-gray-200 p-4 space-y-4 overflow-y-auto">
                {/* Sale Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-700 mb-3 text-sm">Resumen</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal:</span>
                      <span>${completedData.subtotal.toLocaleString()}</span>
                    </div>
                    {completedData.discount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Descuento:</span>
                        <span>-${completedData.discount.toLocaleString()}</span>
                      </div>
                    )}
                    {completedData.tax > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>IVA ({taxRate}%):</span>
                        <span>${completedData.tax.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-300 pt-2 mt-2">
                      <div className="flex justify-between text-lg font-bold text-gray-900">
                        <span>Total:</span>
                        <span>${completedData.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Info */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Método:</span>
                    <span className="font-medium text-blue-700">
                      {completedData.paymentMethod === 'cash' ? 'Efectivo' :
                       completedData.paymentMethod === 'card' ? 'Tarjeta' :
                       completedData.paymentMethod === 'transfer' ? 'Transferencia' :
                       completedData.paymentMethod === 'debe' ? 'Debe (fiado)' : 'Mixto'}
                    </span>
                  </div>
                  {isDebt && (
                    <div className="mt-3 pt-3 border-t border-blue-200 space-y-1 text-sm">
                      {abono > 0 && (
                        <div className="flex justify-between">
                          <span className="text-green-700">Abonó:</span>
                          <span className="font-medium text-green-700">${abono.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-amber-700 font-medium">Queda debiendo:</span>
                        <span className="font-bold text-amber-700">
                          ${Math.max(0, completedData.total - abono).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                  {completedData.paymentMethod !== 'card' && completedData.change > 0 && (
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-blue-200">
                      <span className="text-green-700 font-medium">Cambio:</span>
                      <span className="text-xl font-bold text-green-600">
                        ${completedData.change.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Email */}
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4 text-purple-600" />
                    <span className="font-medium text-purple-800 text-sm">Enviar por email</span>
                  </div>
                  {emailSent ? (
                    <div className="flex items-center gap-2 text-xs text-purple-700">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span>Enviada a: {emailInput}</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="cliente@email.com"
                        className="flex-1 px-3 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                      />
                      <button
                        onClick={handleSendEmail}
                        disabled={sendingEmail || !emailInput.trim()}
                        className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
                      >
                        {sendingEmail ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Mail className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={handlePrint}
                    disabled={loadingPdf || printing}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium transition-colors"
                  >
                    {printing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Printer className="w-5 h-5" />
                    )}
                    {printing ? 'Imprimiendo...' : 'Imprimir'}
                  </button>

                  <button
                    onClick={handleDownload}
                    disabled={!pdfUrl || loadingPdf}
                    className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center gap-2 font-medium transition-colors"
                  >
                    <Download className="w-5 h-5" />
                    Descargar PDF
                  </button>

                  <button
                    onClick={handleWhatsApp}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-medium transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Enviar por WhatsApp
                  </button>

                  <button
                    onClick={onClose}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-medium transition-colors"
                  >
                    Nueva Venta
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Right Panel - PDF Preview */}
              <div className="flex-1 bg-gray-100 p-4 overflow-hidden">
                <div className="h-full bg-white rounded-lg shadow-inner overflow-hidden">
                  {loadingPdf ? (
                    <div className="h-full flex items-center justify-center min-h-[400px]">
                      <div className="text-center">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-3" />
                        <p className="text-gray-600">Generando recibo...</p>
                      </div>
                    </div>
                  ) : pdfUrl ? (
                    <iframe
                      src={pdfUrl}
                      className="w-full h-full min-h-[400px]"
                      title="Vista previa del recibo"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center min-h-[400px]">
                      <p className="text-gray-500">Error al cargar el recibo</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
