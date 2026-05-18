<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Lógica de pagos: intentos de pago, verificación manual, reembolsos y estadísticas.
 */
class PaymentService
{
    private const STATUS_LABELS = [
        'PENDING' => 'Pendiente',
        'PROCESSING' => 'En Proceso',
        'APPROVED' => 'Aprobado',
        'DECLINED' => 'Rechazado',
        'FAILED' => 'Fallido',
        'CANCELLED' => 'Cancelado',
        'EXPIRED' => 'Expirado',
        'REFUNDED' => 'Reembolsado',
        'PARTIAL_REFUND' => 'Reembolso Parcial',
    ];

    public function formatPayment(Payment $payment): array
    {
        return [
            'id' => $payment->id,
            'orderId' => $payment->orderId,
            'orderNumber' => $payment->order?->orderNumber,
            'transactionId' => $payment->transactionId,
            'paymentMethod' => $payment->paymentMethod,
            'amount' => (float) $payment->amount,
            'currency' => $payment->currency,
            'status' => $payment->status,
            'statusLabel' => self::STATUS_LABELS[$payment->status] ?? $payment->status,
            'receiptUrl' => $payment->receiptUrl,
            'receiptData' => $payment->receiptData,
            'payerName' => $payment->payerName,
            'payerEmail' => $payment->payerEmail,
            'payerPhone' => $payment->payerPhone,
            'payerDocument' => $payment->payerDocument,
            'failureReason' => $payment->failureReason,
            'failureCode' => $payment->failureCode,
            'verifiedBy' => $payment->verifiedBy,
            'verifiedByName' => null,
            'verifiedAt' => $payment->verifiedAt,
            'notes' => $payment->notes,
            'refundedAmount' => (float) $payment->refundedAmount,
            'refundedAt' => $payment->refundedAt,
            'refundReason' => $payment->refundReason,
            'initiatedAt' => $payment->initiatedAt,
            'paidAt' => $payment->paidAt,
            'failedAt' => $payment->failedAt,
            'cancelledAt' => $payment->cancelledAt,
            'expiredAt' => $payment->expiredAt,
            'createdAt' => $payment->createdAt,
            'updatedAt' => $payment->updatedAt,
        ];
    }

    public function createPayment(array $data): Payment
    {
        if (! Order::whereKey($data['orderId'])->exists()) {
            throw new RuntimeException('Pedido no encontrado', 404);
        }

        $payment = Payment::create([
            'orderId' => $data['orderId'],
            'transactionId' => $data['transactionId'] ?? null,
            'paymentMethod' => $data['paymentMethod'],
            'amount' => $data['amount'],
            'currency' => $data['currency'] ?? 'COP',
            'status' => 'PENDING',
            'payerName' => $data['payerName'] ?? null,
            'payerEmail' => $data['payerEmail'] ?? null,
            'payerPhone' => $data['payerPhone'] ?? null,
            'payerDocument' => $data['payerDocument'] ?? null,
            'initiatedAt' => now(),
        ]);

        return $payment->load('order:id,orderNumber');
    }

    public function listPayments(array $query): array
    {
        $page = max(1, (int) ($query['page'] ?? 1));
        $limit = max(1, (int) ($query['limit'] ?? 20));

        $builder = Payment::with('order:id,orderNumber');

        foreach (['status', 'paymentMethod', 'orderId'] as $key) {
            if (! empty($query[$key])) {
                $builder->where($key, $query[$key]);
            }
        }
        if (! empty($query['transactionId'])) {
            $builder->where('transactionId', 'like', "%{$query['transactionId']}%");
        }
        if (! empty($query['startDate'])) {
            $builder->where('initiatedAt', '>=', $query['startDate']);
        }
        if (! empty($query['endDate'])) {
            $builder->where('initiatedAt', '<=', $query['endDate']);
        }
        if (! empty($query['search'])) {
            $s = $query['search'];
            $builder->where(function ($q) use ($s) {
                $q->where('transactionId', 'like', "%{$s}%")
                    ->orWhere('payerName', 'like', "%{$s}%")
                    ->orWhere('payerEmail', 'like', "%{$s}%")
                    ->orWhere('payerDocument', 'like', "%{$s}%")
                    ->orWhereHas('order', fn ($o) => $o->where('orderNumber', 'like', "%{$s}%"));
            });
        }

        $sortBy = in_array($query['sortBy'] ?? '', ['initiatedAt', 'amount', 'status'], true)
            ? $query['sortBy'] : 'initiatedAt';
        $sortOrder = ($query['sortOrder'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        $total = $builder->count();
        $payments = $builder->orderBy($sortBy, $sortOrder)
            ->skip(($page - 1) * $limit)->take($limit)->get();

        return [
            'data' => $payments->map(fn ($p) => $this->formatPayment($p))->all(),
            'meta' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => (int) ceil($total / $limit),
            ],
        ];
    }

    public function getByOrderId(int $orderId): array
    {
        return Payment::with('order:id,orderNumber')
            ->where('orderId', $orderId)
            ->orderByDesc('initiatedAt')
            ->get()
            ->map(fn ($p) => $this->formatPayment($p))
            ->all();
    }

    public function getById(int $id): Payment
    {
        $payment = Payment::with('order:id,orderNumber')->find($id);
        if (! $payment) {
            throw new RuntimeException('Pago no encontrado', 404);
        }

        return $payment;
    }

    public function getByTransactionId(string $transactionId): Payment
    {
        $payment = Payment::with('order:id,orderNumber')->where('transactionId', $transactionId)->first();
        if (! $payment) {
            throw new RuntimeException('Pago no encontrado', 404);
        }

        return $payment;
    }

    public function updatePayment(int $id, array $data): Payment
    {
        $payment = Payment::find($id);
        if (! $payment) {
            throw new RuntimeException('Pago no encontrado', 404);
        }
        if (in_array($payment->status, ['APPROVED', 'REFUNDED', 'PARTIAL_REFUND'], true)) {
            $label = self::STATUS_LABELS[$payment->status];
            throw new RuntimeException("No se puede modificar un pago en estado {$label}");
        }

        if (! empty($data['status'])) {
            $payment->status = $data['status'];
            match ($data['status']) {
                'APPROVED' => $payment->paidAt = now(),
                'FAILED' => $payment->failedAt = now(),
                'CANCELLED' => $payment->cancelledAt = now(),
                'EXPIRED' => $payment->expiredAt = now(),
                default => null,
            };
        }
        foreach (['transactionId', 'receiptUrl', 'receiptData', 'failureReason', 'failureCode', 'notes'] as $field) {
            if (array_key_exists($field, $data)) {
                $payment->{$field} = $data[$field];
            }
        }
        $payment->save();

        return $payment->load('order:id,orderNumber');
    }

    public function verifyPayment(int $id, int $verifiedBy, bool $approved, ?string $notes): Payment
    {
        $payment = Payment::with('order')->find($id);
        if (! $payment) {
            throw new RuntimeException('Pago no encontrado', 404);
        }
        if (! in_array($payment->status, ['PENDING', 'PROCESSING'], true)) {
            $label = self::STATUS_LABELS[$payment->status];
            throw new RuntimeException("No se puede verificar un pago en estado {$label}");
        }

        return DB::transaction(function () use ($payment, $verifiedBy, $approved, $notes) {
            $payment->status = $approved ? 'APPROVED' : 'DECLINED';
            $payment->verifiedBy = $verifiedBy;
            $payment->verifiedAt = now();
            $payment->notes = $notes;
            $payment->paidAt = $approved ? now() : null;
            $payment->failedAt = $approved ? null : now();
            $payment->save();

            if ($approved && $payment->order && $payment->order->status === 'PENDING') {
                $order = $payment->order;
                $history = is_array($order->statusHistory) ? $order->statusHistory : [];
                $history[] = [
                    'status' => 'PAID',
                    'timestamp' => now()->toIso8601String(),
                    'note' => 'Pago verificado y aprobado',
                ];
                $order->status = 'PAID';
                $order->paymentRef = $payment->transactionId ?: "PAY-{$payment->id}";
                $order->paidAt = now();
                $order->statusHistory = $history;
                $order->save();
            }

            return $payment->load('order:id,orderNumber');
        });
    }

    public function refundPayment(int $id, ?float $amount, string $reason): Payment
    {
        $payment = Payment::find($id);
        if (! $payment) {
            throw new RuntimeException('Pago no encontrado', 404);
        }
        if ($payment->status !== 'APPROVED') {
            throw new RuntimeException('Solo se pueden reembolsar pagos aprobados');
        }

        $totalAmount = (float) $payment->amount;
        $alreadyRefunded = (float) $payment->refundedAmount;
        $refundAmount = $amount ?? ($totalAmount - $alreadyRefunded);

        if ($refundAmount <= 0) {
            throw new RuntimeException('El monto a reembolsar debe ser mayor a cero');
        }
        if ($alreadyRefunded + $refundAmount > $totalAmount) {
            throw new RuntimeException('El monto total de reembolsos excede el monto del pago');
        }

        $newRefunded = $alreadyRefunded + $refundAmount;
        $payment->status = $newRefunded >= $totalAmount ? 'REFUNDED' : 'PARTIAL_REFUND';
        $payment->refundedAmount = $newRefunded;
        $payment->refundedAt = now();
        $payment->refundReason = $reason;
        $payment->save();

        return $payment->load('order:id,orderNumber');
    }

    public function cancelPayment(int $id, ?string $reason): Payment
    {
        $payment = Payment::find($id);
        if (! $payment) {
            throw new RuntimeException('Pago no encontrado', 404);
        }
        if (! in_array($payment->status, ['PENDING', 'PROCESSING'], true)) {
            $label = self::STATUS_LABELS[$payment->status];
            throw new RuntimeException("No se puede cancelar un pago en estado {$label}");
        }

        $payment->status = 'CANCELLED';
        $payment->cancelledAt = now();
        $payment->notes = $reason ?: 'Pago cancelado';
        $payment->save();

        return $payment->load('order:id,orderNumber');
    }

    public function getStats(): array
    {
        $byStatus = Payment::selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status');
        $byMethod = Payment::selectRaw('paymentMethod, count(*) as c, sum(amount) as total')
            ->groupBy('paymentMethod')->get();
        $revenueAmount = (float) Payment::where('status', 'APPROVED')->sum('amount');
        $revenueRefunded = (float) Payment::where('status', 'APPROVED')->sum('refundedAmount');

        return [
            'total' => Payment::count(),
            'pending' => (int) ($byStatus['PENDING'] ?? 0),
            'byStatus' => $byStatus->map(fn ($v) => (int) $v)->all(),
            'byMethod' => $byMethod->map(fn ($m) => [
                'method' => $m->paymentMethod,
                'count' => (int) $m->c,
                'total' => (float) $m->total,
            ])->all(),
            'revenue' => [
                'total' => $revenueAmount,
                'refunded' => $revenueRefunded,
                'net' => $revenueAmount - $revenueRefunded,
            ],
        ];
    }
}
