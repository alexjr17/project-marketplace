// Wompi (https://docs.wompi.co/).
// El front solo carga el widget. La firma de integridad, el monto y la referencia los
// entrega el backend (POST /orders/my/{id}/wompi-checkout) y la confirmación del pago
// también la hace el backend (POST /orders/confirm-payment/{orderNumber} y el webhook).
// Ninguna clave privada ni de integridad debe llegar al navegador.

export const WOMPI_WIDGET_URL = 'https://checkout.wompi.co/widget.js';

/** Datos firmados por el servidor para abrir el widget (POST /orders/my/{id}/wompi-checkout). */
export interface WompiCheckoutData {
  publicKey: string;
  isTestMode: boolean;
  reference: string;
  amountInCents: number;
  currency: string;
  signature: string | null;
}
