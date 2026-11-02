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
  UserCog,
  UserPlus,
  CreditCard,
  Hash,
  MessageCircle,
  Wallet,
} from 'lucide-react';
import * as posService from '../../services/pos.service';
import type { SelectedCustomer } from './CustomerSelect';
import { Button, Field, MoneyInput, SelectInput, TextInput, toast } from '../ui';

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
  /** Notifica al padre cuando se edita/registra el cliente desde el cobro. */
  onCustomerChange?: (customer: SelectedCustomer | null) => void;
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
  // Datos de transacción precargados (al editar una venta existente).
  initialCardReference?: string;
  initialCardType?: string;
  initialCardLastFour?: string;
}

export const CheckoutModal = ({
  isOpen,
  onClose,
  onConfirm,
  total,
  paymentMethod,
  initialCustomer,
  onCustomerChange,
  abono = 0,
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
  initialCardReference,
  initialCardType,
  initialCardLastFour,
}: CheckoutModalProps) => {
  const [step, setStep] = useState<CheckoutStep>('customer');

  // Cliente local: se inicializa del padre pero puede editarse/registrarse aquí (inline).
  const [customer, setCustomer] = useState<SelectedCustomer | null | undefined>(initialCustomer);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [custName, setCustName] = useState('');
  const [custCedula, setCustCedula] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');

  // Abre el editor inline precargando los datos del cliente actual.
  // Toma el nombre tal cual (aunque no esté registrado o sea el por defecto).
  const startEditCustomer = () => {
    setCustName(customer?.name ?? '');
    setCustCedula(customer?.cedula ?? '');
    setCustPhone(customer?.phone ?? '');
    setCustEmail(customer?.email ?? '');
    setEditingCustomer(true);
  };

  const saveCustomerInline = () => {
    if (!custName.trim()) return;
    const updated: SelectedCustomer = {
      id: customer?.id,
      name: custName.trim(),
      cedula: custCedula.trim() || null,
      phone: custPhone.trim() || null,
      email: custEmail.trim() || null,
    };
    setCustomer(updated);
    onCustomerChange?.(updated);
    setEditingCustomer(false);
  };

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
  const emailRef = useRef<HTMLInputElement>(null);

  // Atajos de teclado en la pantalla de venta exitosa.
  useEffect(() => {
    if (!isOpen || step !== 'completed') return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const key = e.key.toLowerCase();
      if (key === 'enter' && !typing) { e.preventDefault(); onClose(); return; }
      if (typing) return;
      if (key === 'i') { e.preventDefault(); handlePrint(); }
      else if (key === 'd') { e.preventDefault(); handleDownload(); }
      else if (key === 'w') { e.preventDefault(); handleWhatsApp(); }
      else if (key === 'e') { e.preventDefault(); emailRef.current?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, step, pdfUrl, completedData, printing, loadingPdf]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('customer');
      setCustomer(initialCustomer);
      setEditingCustomer(false);
      setEmailInput(initialCustomer?.email || '');
      setCompletedData(null);
      setPdfUrl(null);
      setEmailSent(false);
      setSendInvoiceEmail(!!initialCustomer?.email);
      // Datos de tarjeta/transferencia: precargados si se edita, si no vacíos.
      setCardReference(initialCardReference || '');
      setCardType(initialCardType || '');
      setCardLastFour(initialCardLastFour || '');

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

    // Fiado: exige cliente identificado.
    if (isDebt && !customer) {
      toast.error('Para una venta a crédito (Debe) selecciona o registra un cliente.');
      return;
    }

    // Validar monto recibido para efectivo / mixto.
    if (paymentMethod === 'cash' && cashNum < total) {
      toast.error('El monto recibido es menor al total.');
      return;
    }
    if (paymentMethod === 'mixed' && paid < total) {
      toast.error('Lo pagado (efectivo + transfer) es menor al total.');
      return;
    }

    setStep('processing');

    try {
      const result = await onConfirm({
        customerId: customer?.id,
        customerName: customer?.name || undefined,
        customerEmail: customer?.email || undefined,
        customerPhone: customer?.phone || undefined,
        customerNit: customer?.cedula || undefined,
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
    const raw = (customer?.phone || '').replace(/\D/g, '');
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

  const methodLabel =
    paymentMethod === 'cash' ? 'Efectivo' :
    paymentMethod === 'card' ? 'Tarjeta' :
    paymentMethod === 'transfer' ? 'Transferencia' :
    paymentMethod === 'debe' ? 'Debe (fiado)' : 'Mixto';

  const confirmDisabled =
    (isDebt && !customer) ||
    (paymentMethod === 'cash' && cashNum < total) ||
    (paymentMethod === 'mixed' && paid < total);

  const row = (label: string, value: React.ReactNode, cls = 'text-gray-700') => (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium ${cls}`}>{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      {/* Fondo */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal: compacto para cobrar; ancho solo en el recibo final (PDF) */}
      <div className={`relative bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full max-h-[95vh] flex flex-col overflow-hidden animate-fade-in ${step === 'completed' ? 'max-w-4xl' : 'max-w-md'}`}>
        {/* Encabezado */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-full ${step === 'completed' ? 'bg-green-100 text-green-600' : 'bg-app-100 text-app-600'}`}>
              {step === 'completed' ? (
                <CheckCircle className="w-6 h-6" />
              ) : step === 'processing' ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Wallet className="w-6 h-6" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">
                {step === 'completed' ? 'Venta exitosa' : step === 'processing' ? 'Procesando venta…' : 'Confirmar cobro'}
              </h2>
              <p className="text-sm text-gray-500 truncate">
                {step === 'completed' && completedData
                  ? `Recibo #${completedData.sale.orderNumber}`
                  : step === 'processing'
                  ? 'Por favor espere…'
                  : `${methodLabel} · Revisa el cliente y el pago`}
              </p>
            </div>
          </div>
          {step !== 'processing' && (
            <button onClick={onClose} title="Cerrar" className="p-1.5 -mr-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Contenido */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* PASO: Cliente y pago */}
          {step === 'customer' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 p-5 overflow-y-auto space-y-4">
                {/* Cliente: editor inline (sin modal encima) */}
                {editingCustomer ? (
                  <div className="rounded-lg border border-app-200 p-3 space-y-3">
                    <div className="flex items-center gap-2 text-app-700">
                      <UserCog className="w-4 h-4" />
                      <span className="text-sm font-semibold">Datos del cliente</span>
                    </div>
                    <TextInput autoFocus value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Nombre *" />
                    <div className="grid grid-cols-2 gap-2">
                      <TextInput value={custCedula} onChange={(e) => setCustCedula(e.target.value)} placeholder="Cédula / NIT" />
                      <TextInput type="tel" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="Teléfono" />
                    </div>
                    <TextInput type="email" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} placeholder="Email (opcional)" />
                    <p className="text-xs text-gray-500">Solo el nombre es obligatorio. Lo demás es opcional.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" onClick={() => setEditingCustomer(false)}>Cancelar</Button>
                      <Button onClick={saveCustomerInline} disabled={!custName.trim()}>Guardar</Button>
                    </div>
                  </div>
                ) : customer ? (
                  <div className="rounded-lg border border-gray-200 p-3 flex items-start gap-3">
                    <div className="p-2 rounded-full bg-gray-100 flex-shrink-0"><User className="w-4 h-4 text-gray-500" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{customer.name}</p>
                      {customer.cedula && <p className="text-xs text-gray-600 truncate">CC/NIT {customer.cedula}</p>}
                      {customer.phone && <p className="text-xs text-gray-600 truncate">{customer.phone}</p>}
                      <p className="text-xs text-gray-400 truncate">
                        {customer.id ? 'Cliente existente' : 'Cliente nuevo · se registra al cobrar'}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" icon={<UserCog className="w-4 h-4" />} onClick={startEditCustomer} title="Editar / completar datos del cliente">
                      Editar
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-500">Sin cliente (consumidor final)</p>
                      {isDebt && <p className="mt-1 text-xs text-amber-700">Registra un cliente para el fiado.</p>}
                    </div>
                    <Button variant="outline" size="sm" icon={<UserPlus className="w-4 h-4" />} onClick={startEditCustomer}>
                      Registrar
                    </Button>
                  </div>
                )}

                {/* Datos de la transacción: tarjeta, transferencia o mixto */}
                {(paymentMethod === 'card' || paymentMethod === 'transfer' || paymentMethod === 'mixed') && (
                  <div className="rounded-lg border border-gray-200 p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-app-600" />
                      <span className="text-sm font-semibold text-gray-900">Datos de la transacción</span>
                    </div>
                    <Field label="Referencia / Autorización">
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                        <TextInput value={cardReference} onChange={(e) => setCardReference(e.target.value)} placeholder="Número de autorización del datáfono" className="pl-9" />
                      </div>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Tipo">
                        <SelectInput value={cardType} onChange={(e) => setCardType(e.target.value)}>
                          <option value="">Seleccionar…</option>
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
                        </SelectInput>
                      </Field>
                      <Field label="Últimos 4 / Celular">
                        <TextInput
                          value={cardLastFour}
                          onChange={(e) => {
                            // Solo dígitos, máximo 10
                            const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setCardLastFour(value);
                          }}
                          placeholder="1234 o 3001234567"
                          maxLength={10}
                          inputMode="numeric"
                        />
                      </Field>
                    </div>
                    <p className="text-xs text-gray-500">Estos datos ayudan a rastrear las transacciones digitales.</p>
                  </div>
                )}

                {/* Montos según el método */}
                {paymentMethod === 'cash' && (
                  <Field label="Monto recibido">
                    <MoneyInput
                      ref={cashInputRef}
                      value={cashAmount}
                      onChange={(e) => onCashAmountChange(e.target.value)}
                      placeholder="0"
                      className="h-12 text-lg font-semibold"
                    />
                  </Field>
                )}

                {paymentMethod === 'mixed' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Efectivo">
                      <MoneyInput ref={cashInputRef} value={cashAmount} onChange={(e) => onCashAmountChange(e.target.value)} placeholder="0" className="h-12 text-lg font-semibold" />
                    </Field>
                    <Field label="Transferencia">
                      <MoneyInput value={cardAmount} onChange={(e) => onCardAmountChange(e.target.value)} placeholder="0" className="h-12 text-lg font-semibold" />
                    </Field>
                  </div>
                )}

                {paymentMethod === 'debe' && (
                  <Field label="Abono ahora" hint="Opcional">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <MoneyInput value={abonoAmount} onChange={(e) => onAbonoAmountChange(e.target.value)} placeholder="0" max={total} className="h-12 text-lg font-semibold" />
                      </div>
                      <SelectInput value={abonoMethod} onChange={(e) => onAbonoMethodChange(e.target.value as 'cash' | 'transfer')} className="!w-auto h-12">
                        <option value="cash">Efectivo</option>
                        <option value="transfer">Transfer</option>
                      </SelectInput>
                    </div>
                  </Field>
                )}

                {/* Resumen */}
                <div className="rounded-lg border border-gray-200 p-3 space-y-1.5 text-sm">
                  {row('Productos', itemCount)}
                  {row('Subtotal', `$${subtotal.toLocaleString()}`)}
                  {discount > 0 && row('Descuento', `-$${discount.toLocaleString()}`, 'text-red-600')}
                  {tax > 0 && row('IVA', `$${tax.toLocaleString()}`)}
                  <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
                    <span className="text-gray-900 font-semibold">Total</span>
                    <span className="text-2xl font-bold text-gray-900">${total.toLocaleString()}</span>
                  </div>
                  {(paymentMethod === 'cash' || paymentMethod === 'mixed') && paid > 0 && row('Recibido', `$${paid.toLocaleString()}`)}
                  {(paymentMethod === 'cash' || paymentMethod === 'mixed') && change > 0 && (
                    <div className="flex justify-between items-center rounded-md bg-green-50 px-2 py-1.5 -mx-1">
                      <span className="text-green-800 font-semibold">Vuelto</span>
                      <span className="text-xl font-bold text-green-700">${change.toLocaleString()}</span>
                    </div>
                  )}
                  {paymentMethod === 'debe' && (
                    <>
                      {row('Abono ahora', `$${abonoNum.toLocaleString()}`, 'text-green-700')}
                      {row('Queda debiendo', `$${Math.max(0, total - abonoNum).toLocaleString()}`, 'font-bold text-amber-700')}
                    </>
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 grid grid-cols-2 gap-2">
                <Button variant="secondary" size="lg" onClick={onClose}>Cancelar</Button>
                <Button variant="success" size="lg" icon={<CheckCircle className="w-5 h-5" />} onClick={handleConfirmSale} disabled={confirmDisabled}>
                  {isDebt ? 'Registrar fiado' : 'Confirmar venta'}
                </Button>
              </div>
            </div>
          )}

          {/* PASO: Procesando */}
          {step === 'processing' && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <span className="block w-12 h-12 border-4 border-app-200 border-t-app-600 rounded-full animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Procesando venta…</h3>
                <p className="text-sm text-gray-500">Por favor espere mientras se registra la transacción</p>
              </div>
            </div>
          )}

          {/* PASO: Completado */}
          {step === 'completed' && completedData && (
            <>
              {/* Panel izquierdo: acciones (el detalle ya va en el recibo) */}
              <div className="lg:w-80 border-b lg:border-b-0 lg:border-r border-gray-200 p-4 space-y-3 overflow-y-auto">
                {completedData.change > 0 && (
                  <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-green-800">Vuelto</span>
                    <span className="text-2xl font-bold text-green-700">${completedData.change.toLocaleString()}</span>
                  </div>
                )}

                {/* Nueva venta: acción principal */}
                <Button size="lg" fullWidth onClick={onClose} title="Nueva venta — atajo: Enter">
                  Nueva venta
                  <ArrowRight className="w-5 h-5" />
                  <kbd className="text-[10px] font-bold bg-white/20 rounded px-1.5 py-0.5 ml-1">Enter</kbd>
                </Button>

                {/* Acciones secundarias: imprimir / descargar / whatsapp */}
                <div className="grid grid-cols-3 gap-2">
                  <ReceiptAction onClick={handlePrint} disabled={loadingPdf || printing} title="Imprimir — atajo: I" hotkey="I" icon={printing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}>
                    {printing ? 'Imprimiendo' : 'Imprimir'}
                  </ReceiptAction>
                  <ReceiptAction onClick={handleDownload} disabled={!pdfUrl || loadingPdf} title="Descargar PDF — atajo: D" hotkey="D" icon={<Download className="w-5 h-5" />}>
                    Descargar
                  </ReceiptAction>
                  <ReceiptAction onClick={handleWhatsApp} title="Enviar por WhatsApp — atajo: W" hotkey="W" icon={<MessageCircle className="w-5 h-5" />}>
                    WhatsApp
                  </ReceiptAction>
                </div>

                {/* Email */}
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4 text-app-600" />
                    <span className="font-medium text-gray-900 text-sm">Enviar por email</span>
                  </div>
                  {emailSent ? (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                      <span className="truncate">Enviada a: {emailInput}</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <TextInput
                        ref={emailRef}
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendEmail()}
                        placeholder="cliente@email.com"
                        title="Email — atajo: E para enfocar"
                        className="min-w-0"
                      />
                      <Button variant="outline" onClick={handleSendEmail} disabled={!emailInput.trim()} isLoading={sendingEmail} title="Enviar" icon={!sendingEmail ? <Mail className="w-4 h-4" /> : undefined} />
                    </div>
                  )}
                </div>
              </div>

              {/* Panel derecho: vista previa del PDF */}
              <div className="flex-1 bg-gray-100 p-4 overflow-hidden">
                <div className="h-full bg-white rounded-lg border border-gray-200 overflow-hidden">
                  {loadingPdf ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 min-h-[400px] text-gray-500">
                      <span className="w-8 h-8 border-[3px] border-app-200 border-t-app-600 rounded-full animate-spin" />
                      <p className="text-sm">Generando recibo…</p>
                    </div>
                  ) : pdfUrl ? (
                    <iframe src={pdfUrl} className="w-full h-full min-h-[400px]" title="Vista previa del recibo" />
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

/** Botón cuadrado de acción del recibo, con su atajo de teclado en la esquina. */
function ReceiptAction({ onClick, disabled, title, hotkey, icon, children }: {
  onClick: () => void; disabled?: boolean; title: string; hotkey: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="relative flex flex-col items-center justify-center gap-1 h-16 px-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-xs font-medium transition-colors"
    >
      <span className="absolute top-1 right-1.5 text-[10px] font-bold text-gray-300">{hotkey}</span>
      {icon}
      {children}
    </button>
  );
}

export default CheckoutModal;
