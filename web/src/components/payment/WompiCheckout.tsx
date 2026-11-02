import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CreditCard, Loader2, Shield } from 'lucide-react';
import { Alert, Button } from '../ui';
import { WOMPI_WIDGET_URL, type WompiCheckoutData } from '../../services/wompi.service';

interface WompiCheckoutProps {
  /** Llave pública configurada (solo para saber si Wompi está disponible). */
  publicKey: string;
  /** Total estimado a mostrar; el que se cobra lo calcula el servidor. */
  amountInCents: number;
  customerEmail?: string;
  customerFullName?: string;
  customerPhone?: string;
  /**
   * Crea (o reutiliza) el pedido pendiente y pide al servidor los datos firmados.
   * La firma de integridad se calcula en el backend: la clave nunca llega al navegador.
   */
  prepare: () => Promise<WompiCheckoutData>;
  /** El widget terminó con una transacción (APPROVED o PENDING): confirmar en el backend. */
  onPaymentResult: (transactionId: string, reference: string) => void;
  onPaymentError?: (error: string) => void;
  onClose?: () => void;
}

declare global {
  interface Window {
    WidgetCheckout?: new (config: WompiWidgetConfig) => WompiWidgetInstance;
  }
}

interface WompiWidgetConfig {
  currency: string;
  amountInCents: number;
  reference: string;
  publicKey: string;
  signature?: { integrity: string };
  customerData?: { email?: string; fullName?: string; phoneNumber?: string; phoneNumberPrefix?: string };
}

interface WompiWidgetInstance {
  open: (callback: (result: WompiResult) => void) => void;
}

interface WompiResult {
  transaction?: { id: string; status: 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING'; reference: string };
}

const isValidPublicKey = (key: string) =>
  Boolean(key) && key !== 'pub_test_SIMULATION' && (key.startsWith('pub_test_') || key.startsWith('pub_prod_'));

const money = (cents: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(cents / 100);

export const WompiCheckout = ({
  publicKey,
  amountInCents,
  customerEmail,
  customerFullName,
  customerPhone,
  prepare,
  onPaymentResult,
  onPaymentError,
  onClose,
}: WompiCheckoutProps) => {
  const available = isValidPublicKey(publicKey);
  const [scriptReady, setScriptReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const loading = useRef(false);

  // Carga el script del widget una sola vez.
  useEffect(() => {
    if (!available || loading.current) return;
    loading.current = true;
    if (window.WidgetCheckout) { setScriptReady(true); return; }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${WOMPI_WIDGET_URL}"]`);
    const script = existing ?? document.createElement('script');
    const onLoad = () => setScriptReady(true);
    const onError = () => onPaymentError?.('No se pudo cargar la pasarela de Wompi. Recarga la página.');
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    if (!existing) {
      script.src = WOMPI_WIDGET_URL;
      script.async = true;
      document.body.appendChild(script);
    }
    return () => { script.removeEventListener('load', onLoad); script.removeEventListener('error', onError); };
  }, [available, onPaymentError]);

  const handlePay = async () => {
    if (!window.WidgetCheckout) {
      onPaymentError?.('Wompi no está disponible. Recarga la página.');
      return;
    }
    setProcessing(true);
    let data: WompiCheckoutData;
    try {
      data = await prepare();
    } catch (e) {
      setProcessing(false);
      onPaymentError?.(e instanceof Error ? e.message : 'No se pudo preparar el pago.');
      return;
    }

    try {
      const widget = new window.WidgetCheckout({
        currency: data.currency,
        amountInCents: data.amountInCents,
        reference: data.reference,
        publicKey: data.publicKey,
        ...(data.signature ? { signature: { integrity: data.signature } } : {}),
        customerData: { email: customerEmail, fullName: customerFullName, phoneNumber: customerPhone, phoneNumberPrefix: '+57' },
      });
      widget.open((result) => {
        setProcessing(false);
        const tx = result.transaction;
        if (!tx) { onClose?.(); return; }
        if (tx.status === 'APPROVED' || tx.status === 'PENDING') onPaymentResult(tx.id, tx.reference);
        else if (tx.status === 'DECLINED') onPaymentError?.('El pago fue rechazado. Intenta con otro medio de pago.');
        else if (tx.status === 'ERROR') onPaymentError?.('Ocurrió un error al procesar el pago. Intenta de nuevo.');
        else onClose?.();
      });
    } catch {
      setProcessing(false);
      onPaymentError?.('No se pudo abrir la pasarela de pago.');
    }
  };

  if (!available) {
    return (
      <Alert tone="warning" title="Wompi no está configurado">
        El pago con Wompi no está disponible en este momento. Elige otro método de pago o contacta a la tienda.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <span className="text-sm text-gray-600">Total a pagar</span>
        <span className="text-xl font-semibold text-gray-900 tabular-nums">{money(amountInCents)}</span>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-gray-600">
        {['Tarjeta crédito', 'Tarjeta débito', 'PSE', 'Nequi'].map((m) => (
          <span key={m} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1"><CreditCard className="w-3.5 h-3.5" />{m}</span>
        ))}
      </div>

      <Button size="lg" fullWidth onClick={handlePay} isLoading={processing} disabled={!scriptReady}
        icon={!scriptReady ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}>
        {!scriptReady ? 'Cargando Wompi…' : processing ? 'Procesando…' : `Pagar con Wompi ${money(amountInCents)}`}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
        <Shield className="w-4 h-4 text-green-600" /> Pago seguro procesado por Wompi
      </p>
      <p className="flex items-start gap-1.5 text-xs text-gray-400">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" /> El pedido se crea como pendiente al pagar y se confirma cuando Wompi aprueba la transacción.
      </p>
    </div>
  );
};
