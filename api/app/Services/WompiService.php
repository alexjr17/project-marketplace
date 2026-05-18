<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Integración con la pasarela de pagos Wompi (Colombia):
 * validación de webhooks, verificación de transacciones y confirmación de pagos.
 */
class WompiService
{
    public function __construct(private OrderService $orders) {}

    private function credentials(): array
    {
        $publicKey = (string) env('WOMPI_PUBLIC_KEY', '');

        return [
            'publicKey' => $publicKey,
            'privateKey' => (string) env('WOMPI_PRIVATE_KEY', ''),
            'eventsSecret' => (string) env('WOMPI_EVENTS_SECRET', ''),
            'isTestMode' => $publicKey === '' || str_starts_with($publicKey, 'pub_test_'),
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
            return true; // En desarrollo, sin secret, se permite.
        }

        try {
            $properties = $event['signature']['properties'] ?? [];
            $checksum = $event['signature']['checksum'] ?? '';

            $values = [];
            foreach ($properties as $prop) {
                $value = $event;
                foreach (explode('.', $prop) as $key) {
                    $value = $value[$key] ?? null;
                }
                $values[] = $value;
            }

            $stringToHash = implode('', $values).($event['timestamp'] ?? '').$secret;

            return hash('sha256', $stringToHash) === $checksum;
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
            'APPROVED' => $this->approve($order, $transactionId),
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
            'APPROVED' => $this->approve($order, $transactionId),
            'DECLINED', 'ERROR' => $this->markFailed($order, $status),
            'VOIDED' => $this->voidTransaction($order, $transactionId),
            default => null,
        };

        return ['success' => true, 'message' => "Transacción procesada: {$status}", 'orderId' => $order->id];
    }

    private function approve(Order $order, string $transactionId): array
    {
        if ($order->status === 'PENDING') {
            $order->paymentRef = $transactionId;
            $order->save();

            $this->orders->updateOrderStatus($order->id, [
                'status' => 'PAID',
                'notes' => "Pago confirmado via Wompi. Transacción: {$transactionId}",
            ]);
        }

        return ['success' => true, 'message' => 'Pago confirmado exitosamente', 'status' => 'APPROVED'];
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
