import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle,
  Printer,
  Download,
  Mail,
  X,
  Loader2,
  ArrowRight,
  User,
  CreditCard,
  Hash,
  MessageCircle,
} from 'lucide-react';
import * as posService from '../../services/pos.service';
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
  subtotal: number;
  discount: number;
  itemCount: number;
  cashAmount: string;
  onCashAmountChange: (v: string) => void;
  cardAmount: string;
  onCardAmountChange: (v: string) => void;
  abonoAmount: string;
  onAbonoAmountChange: (v: string) => void;
  abonoMethod: 'cash' | 'transfer';
  onAbonoMethodChange: (v: 'cash' | 'transfer') => void;
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
  subtotal,
  discount,
  itemCount,
  cashAmount,
  onCashAmountChange,
  cardAmount,
  onCardAmountChange,
  abonoAmount,
  onAbonoAmountChange,
  abonoMethod,
  onAbonoMethodChange,
}: CheckoutModalProps) => {
  const [step, setStep] = useState<CheckoutStep>('customer');

  // Payment amount calculations
  const cashNum = parseFloat(cashAmount || '0');
  const cardNum = parseFloat(cardAmount || '0');
  const paid = paymentMethod === 'mixed' ? cashNum + cardNum : cashNum;
  const change = (paymentMethod === 'cash' || paymentMethod === 'mixed') ? Math.max(0, paid - total) : 0;
  const abonoNum = parseFloat(abonoAmount || '0');
  const tax = Math.max(0, Math.round((total - (subtotal - discount)) * 100) / 100);

  // Customer data
  const [emailInput, setEmailInput] = useState('');
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

  const cashInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('customer');
      setEmailInput(initialCustomer?.email || '');
      setCompletedData(null);
      setPdfUrl(null);
      setEmailSent(false);
      setSendInvoiceEmail(!!initialCustomer?.email);
      // Reset card data
      setCardReference('');
      setCardType('');
      setCardLastFour('');

      // Enfocar y seleccionar el campo de monto al abrir (efectivo/mixto)
      setTimeout(() => {
        if (paymentMethod === 'cash' || paymentMethod === 'mixed') {
          cashInputRef.current?.focus();
          cashInputRef.current?.select();
        }
      }, 100);
    }

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [isOpen]);

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

    // Fiado: exige cliente identificado (elegido en la pantalla de venta).
    if (isDebt && !initialCustomer) {
      alert('Para una venta a crédito (Debe) selecciona un cliente en la pantalla de venta.');
      return;
    }

    // Validar monto recibido para efectivo / mixto.
    if (paymentMethod === 'cash' && cashNum < total) {
      alert('El monto recibido es menor al total.');
      return;
    }
    if (paymentMethod === 'mixed' && paid < total) {
      alert('Lo pagado (efectivo + transfer) es menor al total.');
      return;
    }

    setStep('processing');

    try {
      const result = await onConfirm({
        customerId: initialCustomer?.id,
        customerName: initialCustomer?.name || undefined,
        customerEmail: initialCustomer?.email || undefined,
        customerPhone: initialCustomer?.phone || undefined,
        customerNit: initialCustomer?.cedula || undefined,
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
    const raw = (initialCustomer?.phone || '').replace(/\D/g, '');
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

      {/* Modal — compacto para cobrar; ancho solo en el recibo final (PDF) */}
      <div className={`relative bg-white rounded-xl shadow-2xl w-full max-h-[95vh] mx-4 flex flex-col overflow-hidden ${step === 'completed' ? 'max-w-4xl' : 'max-w-md'}`}>
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
                    : 'Confirmar Cobro'}
                </h2>
                <p className="text-white/80 text-sm">
                  {step === 'completed' && completedData
                    ? `Recibo #${completedData.sale.orderNumber}`
                    : step === 'processing'
                    ? 'Por favor espere...'
                    : 'Revisa el cliente y el pago'}
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
            <div className="flex-1 p-4 lg:p-5 overflow-y-auto">
              <div className="space-y-4">
                {/* Cliente (solo lectura) */}
                {initialCustomer ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
                    <User className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{initialCustomer.name}</p>
                      {initialCustomer.cedula && (
                        <p className="text-xs text-gray-600 truncate">CC/NIT {initialCustomer.cedula}</p>
                      )}
                      {initialCustomer.phone && (
                        <p className="text-xs text-gray-600 truncate">{initialCustomer.phone}</p>
                      )}
                      <p className="text-xs text-gray-400 truncate">
                        {initialCustomer.id ? 'Cliente existente' : 'Cliente nuevo · se registra al cobrar'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-sm text-gray-500">Sin cliente (consumidor final)</p>
                    {isDebt && (
                      <p className="mt-1 text-xs text-amber-700">
                        Selecciona un cliente en la pantalla de venta para registrar el fiado.
                      </p>
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

                {/* Pago + Resumen */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  {/* Amount inputs (depending on method) */}
                  {paymentMethod === 'cash' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Monto recibido
                      </label>
                      <input
                        ref={cashInputRef}
                        type="number"
                        value={cashAmount}
                        onChange={(e) => onCashAmountChange(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                      />
                    </div>
                  )}

                  {paymentMethod === 'mixed' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Efectivo
                        </label>
                        <input
                          type="number"
                          value={cashAmount}
                          onChange={(e) => onCashAmountChange(e.target.value)}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Transfer
                        </label>
                        <input
                          type="number"
                          value={cardAmount}
                          onChange={(e) => onCardAmountChange(e.target.value)}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
                        />
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'debe' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Abono ahora (opcional)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={abonoAmount}
                          onChange={(e) => onAbonoAmountChange(e.target.value)}
                          placeholder="0"
                          step="0.01"
                          min="0"
                          max={total}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                        />
                        <select
                          value={abonoMethod}
                          onChange={(e) => onAbonoMethodChange(e.target.value as 'cash' | 'transfer')}
                          className="px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        >
                          <option value="cash">Efectivo</option>
                          <option value="transfer">Transfer</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Productos:</span>
                      <span className="font-medium text-gray-700">{itemCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Subtotal:</span>
                      <span className="font-medium text-gray-700">${subtotal.toLocaleString()}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Descuento:</span>
                        <span className="font-medium text-red-600">-${discount.toLocaleString()}</span>
                      </div>
                    )}
                    {tax > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">IVA:</span>
                        <span className="font-medium text-gray-700">${tax.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t border-gray-300 pt-2 mt-2">
                      <span className="text-gray-700 font-semibold">Total:</span>
                      <span className="text-xl font-bold text-gray-900">${total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Método:</span>
                      <span className="font-medium text-gray-700">
                        {paymentMethod === 'cash' ? 'Efectivo' :
                         paymentMethod === 'card' ? 'Tarjeta' :
                         paymentMethod === 'transfer' ? 'Transferencia' :
                         paymentMethod === 'debe' ? 'Debe (fiado)' : 'Mixto'}
                      </span>
                    </div>
                    {(paymentMethod === 'cash' || paymentMethod === 'mixed') && paid > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Recibido:</span>
                        <span className="font-medium text-gray-700">${paid.toLocaleString()}</span>
                      </div>
                    )}
                    {(paymentMethod === 'cash' || paymentMethod === 'mixed') && change > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-green-700 font-semibold">Vuelto:</span>
                        <span className="text-lg font-bold text-green-600">${change.toLocaleString()}</span>
                      </div>
                    )}
                    {paymentMethod === 'debe' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Abono ahora:</span>
                          <span className="font-medium text-green-700">${abonoNum.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Queda debiendo:</span>
                          <span className="font-bold text-amber-700">
                            ${Math.max(0, total - abonoNum).toLocaleString()}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
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
                    disabled={
                      (isDebt && !initialCustomer) ||
                      (paymentMethod === 'cash' && cashNum < total) ||
                      (paymentMethod === 'mixed' && paid < total)
                    }
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
