<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use App\Support\WebhookGuard;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Integración con la pasarela de pagos Wompi (Colombia):
 * validación de webhooks, verificación de transacciones y confirmación de pagos.
 */
class WompiService
{
    public function __construct(private OrderService $orders, private PaymentGatewayConfig $config) {}

    private function credentials(): array
    {
        return $this->config->wompi();
    }

    /** Monto del pedido en centavos, calculado en el servidor (nunca el que manda el cliente). */
    private function amountInCents(Order $order): int
    {
        return (int) round(((float) $order->total) * 100);
    }

    /**
     * Datos para abrir el widget de Wompi de un pedido: referencia = número del pedido,
     * monto del servidor y firma de integridad calculada aquí (la clave nunca sale al navegador).
     */
    public function checkoutData(Order $order): array
    {
        $cred = $this->credentials();
        if (! $cred['publicKey']) {
            throw new \RuntimeException('El pago con Wompi no está configurado');
        }

        $amount = $this->amountInCents($order);
        $currency = 'COP';

        return [
            'publicKey' => $cred['publicKey'],
            'isTestMode' => $cred['isTestMode'],
            'reference' => $order->orderNumber,
            'amountInCents' => $amount,
            'currency' => $currency,
            'signature' => $cred['integrityKey'] !== ''
                ? hash('sha256', $order->orderNumber.$amount.$currency.$cred['integrityKey'])
                : null,
        ];
    }

    private function baseUrl(bool $isTest): string
    {
        return $isTest ? 'https://sandbox.wompi.co/v1' : 'https://production.wompi.co/v1';
    }

    /** Valida la firma SHA-256 del webhook de Wompi. */
    public function validateWebhookSignature(array $event): bool
    {
        $secret = $this->credentials()['eventsSecret'];
        if (! $secret) {
            return WebhookGuard::allowUnsigned('wompi');
        }

        try {
            $properties = $event['signature']['properties'] ?? [];
            $checksum = $event['signature']['checksum'] ?? '';

            // Las propiedades firmadas son rutas dentro de `data` ("transaction.id" =
            // data.transaction.id). Antes se buscaban desde la raíz del evento, así que con el
            // secreto configurado ningún webhook real de Wompi validaba.
            $values = [];
            foreach ($properties as $prop) {
                $value = $event['data'] ?? [];
                foreach (explode('.', $prop) as $key) {
                    $value = $value[$key] ?? null;
                }
                $values[] = $value;
            }

            $stringToHash = implode('', $values).($event['timestamp'] ?? '').$secret;

            return WebhookGuard::equals(hash('sha256', $stringToHash), is_string($checksum) ? $checksum : null);
        } catch (Throwable $e) {
            Log::error('Wompi validateWebhookSignature: '.$e->getMessage());

            return false;
        }
    }

    /** Consulta los detalles de una transacción directamente con Wompi. */
    public function getTransactionDetails(string $transactionId): ?array
    {
        $cred = $this->credentials();
        if (! $cred['publicKey']) {
            return null;
        }

        try {
            $response = Http::withToken($cred['publicKey'])
                ->get($this->baseUrl($cred['isTestMode'])."/transactions/{$transactionId}");

            if (! $response->successful()) {
                return null;
            }

            $data = $response->json('data') ?? [];

            return [
                'status' => $data['status'] ?? null,
                'reference' => $data['reference'] ?? null,
                'amountInCents' => $data['amount_in_cents'] ?? 0,
                'currency' => $data['currency'] ?? null,
            ];
        } catch (Throwable $e) {
            Log::error('Wompi getTransactionDetails: '.$e->getMessage());

            return null;
        }
    }

    /** Confirma un pago desde el frontend (polling, alternativa al webhook). */
    public function confirmPaymentByTransaction(string $transactionId, string $orderNumber): array
    {
        $transaction = $this->getTransactionDetails($transactionId);
        if (! $transaction) {
            return ['success' => false, 'message' => 'No se pudo verificar la transacción con Wompi'];
        }

        if ($transaction['reference'] !== $orderNumber) {
            return [
                'success' => false,
                'message' => 'La transacción no corresponde a esta orden',
                'status' => $transaction['status'],
            ];
        }

        $order = Order::where('orderNumber', $orderNumber)->first();
        if (! $order) {
            return ['success' => false, 'message' => 'Orden no encontrada'];
        }
        if ($order->status === 'PAID') {
            return ['success' => true, 'message' => 'El pedido ya está pagado', 'status' => 'APPROVED'];
        }

        return match ($transaction['status']) {
            'APPROVED' => $this->approve($order, $transactionId, (int) $transaction['amountInCents'], $transaction['currency']),
            'PENDING' => ['success' => false, 'message' => 'El pago aún está pendiente', 'status' => 'PENDING'],
            'DECLINED', 'ERROR' => $this->markFailed($order, $transaction['status']),
            'VOIDED' => ['success' => false, 'message' => 'La transacción fue anulada', 'status' => 'VOIDED'],
            default => [
                'success' => false,
                'message' => "Estado desconocido: {$transaction['status']}",
                'status' => $transaction['status'],
            ],
        };
    }

    /** Procesa un evento de transacción recibido por webhook. */
    public function processTransactionEvent(array $event): array
    {
        $transaction = $event['data']['transaction'] ?? [];
        $reference = $transaction['reference'] ?? '';
        $status = $transaction['status'] ?? '';
        $transactionId = $transaction['id'] ?? '';

        $order = Order::where('orderNumber', $reference)->first();
        if (! $order) {
            return ['success' => false, 'message' => "Orden no encontrada: {$reference}"];
        }

        match ($status) {
            'APPROVED' => $this->approve($order, $transactionId, (int) ($transaction['amount_in_cents'] ?? 0), $transaction['currency'] ?? null),
            'DECLINED', 'ERROR' => $this->markFailed($order, $status),
            'VOIDED' => $this->voidTransaction($order, $transactionId),
            default => null,
        };

        return ['success' => true, 'message' => "Transacción procesada: {$status}", 'orderId' => $order->id];
    }

    private function approve(Order $order, string $transactionId, int $paidCents, ?string $currency): array
    {
        // El monto y la moneda pagados deben ser los del pedido: si no, no se aprueba
        // (antes se podía pagar menos y el pedido quedaba PAID).
        if ($paidCents !== $this->amountInCents($order) || ($currency !== null && $currency !== 'COP')) {
            Log::warning("Wompi: monto pagado no coincide con el pedido {$order->orderNumber}", [
                'esperado' => $this->amountInCents($order), 'pagado' => $paidCents, 'moneda' => $currency,
            ]);

            return ['success' => false, 'message' => 'El monto pagado no coincide con el pedido', 'status' => 'AMOUNT_MISMATCH'];
        }

        if ($order->status === 'PENDING') {
            $order->paymentRef = $transactionId;
            $order->save();

            $this->orders->updateOrderStatus($order->id, [
                'status' => 'PAID',
                'notes' => "Pago confirmado via Wompi. Transacción: {$transactionId}",
            ]);
            $this->recordApprovedPayment($order, $transactionId, $paidCents / 100);
        }

        return ['success' => true, 'message' => 'Pago confirmado exitosamente', 'status' => 'APPROVED'];
    }

    /** Registro del pago aprobado (lo crea el servidor; antes lo creaba el navegador). */
    private function recordApprovedPayment(Order $order, string $transactionId, float $amount): void
    {
        try {
            Payment::updateOrCreate(
                ['transactionId' => $transactionId],
                [
                    'orderId' => $order->id,
                    'paymentMethod' => 'wompi',
                    'amount' => $amount,
                    'currency' => 'COP',
                    'status' => 'APPROVED',
                    'payerName' => $order->customerName ?? $order->user?->name,
                    'payerEmail' => $order->customerEmail ?? $order->user?->email,
                    'paidAt' => now(),
                ],
            );
        } catch (Throwable $e) {
            Log::error('Wompi recordApprovedPayment: '.$e->getMessage());
        }
    }

    private function markFailed(Order $order, string $status): array
    {
        if ($order->status === 'PENDING') {
            $history = is_array($order->statusHistory) ? $order->statusHistory : [];
            $history[] = [
                'status' => $order->status,
                'timestamp' => now()->toIso8601String(),
                'note' => "Pago fallido: {$status}",
            ];
            $order->statusHistory = $history;
            $order->save();
        }

        return ['success' => false, 'message' => 'El pago fue rechazado', 'status' => $status];
    }

    private function voidTransaction(Order $order, string $transactionId): void
    {
        if ($order->status === 'PAID') {
            $this->orders->updateOrderStatus($order->id, [
                'status' => 'CANCELLED',
                'notes' => "Pago anulado via Wompi. Transacción: {$transactionId}",
            ]);
        }
    }
}
