<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use App\Models\Setting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Integración con Mercado Pago (Checkout Pro): creación de la preferencia de
 * pago, confirmación por webhook y verificación por consulta directa.
 *
 * Las credenciales se leen de la configuración de pagos guardada por el admin
 * (método tipo "mercadopago"), con respaldo en variables de entorno.
 */
class MercadoPagoService
{
    private const API = 'https://api.mercadopago.com';

    public function __construct(private OrderService $orders) {}

    /** Access token + public key desde la configuración guardada (o env). */
    public function credentials(): array
    {
        $accessToken = '';
        $publicKey = '';

        try {
            $setting = Setting::where('key', 'payment_settings')->first();
            $methods = is_array($setting?->value['methods'] ?? null) ? $setting->value['methods'] : [];
            foreach ($methods as $m) {
                if (($m['type'] ?? '') === 'mercadopago') {
                    $cfg = $m['mercadoPagoConfig'] ?? [];
                    $accessToken = (string) ($cfg['accessToken'] ?? '');
                    $publicKey = (string) ($cfg['publicKey'] ?? '');
                    break;
                }
            }
        } catch (Throwable $e) {
            Log::error('MercadoPago credentials: '.$e->getMessage());
        }

        if ($accessToken === '') {
            $accessToken = (string) env('MERCADOPAGO_ACCESS_TOKEN', '');
        }
        if ($publicKey === '') {
            $publicKey = (string) env('MERCADOPAGO_PUBLIC_KEY', '');
        }

        return [
            'accessToken' => $accessToken,
            'publicKey' => $publicKey,
            'isTestMode' => str_starts_with($accessToken, 'TEST-'),
        ];
    }

    private function frontendUrl(): string
    {
        return rtrim((string) env('FRONTEND_URL', 'https://project-marketplace-web.onrender.com'), '/');
    }

    private function notificationUrl(): string
    {
        return rtrim((string) env('APP_URL', ''), '/').'/api/webhooks/mercadopago';
    }

    /**
     * Crea una preferencia de Checkout Pro para una orden y devuelve la URL de pago.
     */
    public function createPreference(Order $order): array
    {
        $cred = $this->credentials();
        if ($cred['accessToken'] === '') {
            return ['success' => false, 'message' => 'Mercado Pago no está configurado (falta Access Token)'];
        }

        $order->loadMissing('items');

        $items = $order->items->map(function ($it) {
            return [
                'title' => mb_substr((string) ($it->productName ?: 'Producto'), 0, 250),
                'quantity' => max(1, (int) $it->quantity),
                'unit_price' => round((float) $it->unitPrice, 2),
                'currency_id' => 'COP',
            ];
        })->values()->all();

        // Envío y descuento como ítems para que el total cuadre con la orden.
        if ((float) $order->shippingCost > 0) {
            $items[] = [
                'title' => 'Envío',
                'quantity' => 1,
                'unit_price' => round((float) $order->shippingCost, 2),
                'currency_id' => 'COP',
            ];
        }
        if ((float) $order->discount > 0) {
            $items[] = [
                'title' => 'Descuento',
                'quantity' => 1,
                'unit_price' => -round((float) $order->discount, 2),
                'currency_id' => 'COP',
            ];
        }

        $frontend = $this->frontendUrl();
        $backUrl = "{$frontend}/order-confirmation/{$order->orderNumber}";

        $payload = [
            'items' => $items,
            'external_reference' => $order->orderNumber,
            'payer' => [
                'name' => (string) $order->customerName,
                'email' => (string) $order->customerEmail,
            ],
            'back_urls' => [
                'success' => $backUrl.'?payment=success',
                'pending' => $backUrl.'?payment=pending',
                'failure' => $backUrl.'?payment=failure',
            ],
            'auto_return' => 'approved',
            'statement_descriptor' => 'StylePrint',
        ];

        $notify = $this->notificationUrl();
        if (str_starts_with($notify, 'https://')) {
            $payload['notification_url'] = $notify;
        }

        try {
            $response = Http::withToken($cred['accessToken'])
                ->acceptJson()
                ->post(self::API.'/checkout/preferences', $payload);

            if (! $response->successful()) {
                Log::error('MercadoPago createPreference: '.$response->body());

                return ['success' => false, 'message' => 'No se pudo crear la preferencia de pago'];
            }

            $data = $response->json();

            return [
                'success' => true,
                'preferenceId' => $data['id'] ?? null,
                'initPoint' => $cred['isTestMode']
                    ? ($data['sandbox_init_point'] ?? $data['init_point'] ?? null)
                    : ($data['init_point'] ?? null),
                'isTestMode' => $cred['isTestMode'],
            ];
        } catch (Throwable $e) {
            Log::error('MercadoPago createPreference: '.$e->getMessage());

            return ['success' => false, 'message' => 'Error al conectar con Mercado Pago'];
        }
    }

    /** Consulta el detalle de un pago en Mercado Pago. */
    public function getPaymentDetails(string $paymentId): ?array
    {
        $cred = $this->credentials();
        if ($cred['accessToken'] === '') {
            return null;
        }

        try {
            $response = Http::withToken($cred['accessToken'])
                ->get(self::API."/v1/payments/{$paymentId}");

            if (! $response->successful()) {
                return null;
            }

            $data = $response->json();

            return [
                'status' => $data['status'] ?? null,                       // approved | pending | rejected | ...
                'externalReference' => $data['external_reference'] ?? null, // orderNumber
                'amount' => $data['transaction_amount'] ?? 0,
                'id' => (string) ($data['id'] ?? $paymentId),
            ];
        } catch (Throwable $e) {
            Log::error('MercadoPago getPaymentDetails: '.$e->getMessage());

            return null;
        }
    }

    /** Procesa un webhook de Mercado Pago (topic=payment). */
    public function processWebhook(array $payload): array
    {
        $type = $payload['type'] ?? $payload['topic'] ?? '';
        $paymentId = $payload['data']['id'] ?? $payload['id'] ?? null;

        if ($type !== 'payment' || ! $paymentId) {
            return ['success' => true, 'message' => 'Evento ignorado'];
        }

        $detail = $this->getPaymentDetails((string) $paymentId);
        if (! $detail || ! $detail['externalReference']) {
            return ['success' => false, 'message' => 'No se pudo verificar el pago'];
        }

        $order = Order::where('orderNumber', $detail['externalReference'])->first();
        if (! $order) {
            return ['success' => false, 'message' => 'Orden no encontrada'];
        }

        if ($detail['status'] === 'approved') {
            $this->approve($order, $detail['id']);

            return ['success' => true, 'message' => 'Pago aprobado', 'orderId' => $order->id];
        }

        return ['success' => true, 'message' => "Pago en estado: {$detail['status']}"];
    }

    /** Confirma por consulta directa (polling desde el back_url de retorno). */
    public function confirmByPaymentId(string $paymentId, string $orderNumber): array
    {
        $detail = $this->getPaymentDetails($paymentId);
        if (! $detail) {
            return ['success' => false, 'message' => 'No se pudo verificar el pago'];
        }
        if ($detail['externalReference'] !== $orderNumber) {
            return ['success' => false, 'message' => 'El pago no corresponde a esta orden'];
        }

        $order = Order::where('orderNumber', $orderNumber)->first();
        if (! $order) {
            return ['success' => false, 'message' => 'Orden no encontrada'];
        }
        if ($order->status === 'PAID') {
            return ['success' => true, 'message' => 'El pedido ya está pagado', 'status' => 'approved'];
        }

        if ($detail['status'] === 'approved') {
            $this->approve($order, $detail['id']);

            return ['success' => true, 'message' => 'Pago confirmado', 'status' => 'approved'];
        }

        return ['success' => false, 'message' => 'El pago aún no está aprobado', 'status' => $detail['status']];
    }

    private function approve(Order $order, string $paymentId): void
    {
        if ($order->status === 'PENDING') {
            $order->paymentRef = $paymentId;
            $order->save();

            $this->orders->updateOrderStatus($order->id, [
                'status' => 'PAID',
                'notes' => "Pago confirmado via Mercado Pago. ID: {$paymentId}",
            ]);
        }

        // Sincroniza el registro de Payment si existe uno pendiente.
        try {
            $payment = Payment::where('orderId', $order->id)
                ->where('paymentMethod', 'mercadopago')
                ->whereIn('status', ['PENDING', 'PROCESSING'])
                ->orderByDesc('initiatedAt')
                ->first();
            if ($payment) {
                $payment->status = 'APPROVED';
                $payment->transactionId = $paymentId;
                $payment->paidAt = now();
                $payment->save();
            }
        } catch (Throwable $e) {
            Log::error('MercadoPago approve sync payment: '.$e->getMessage());
        }
    }
}
