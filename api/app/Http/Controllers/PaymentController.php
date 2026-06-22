<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Order;
use App\Models\Payment;
use App\Services\MercadoPagoService;
use App\Services\PaymentService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class PaymentController extends Controller
{
    use ApiResponse;

    public function __construct(
        private PaymentService $payments,
        private MercadoPagoService $mercadoPago,
    ) {}

    /** Crea una preferencia de Checkout Pro y devuelve la URL de pago. */
    public function mercadopagoPreference(Request $request)
    {
        $data = $request->validate(['orderId' => 'required|integer']);

        $order = Order::find($data['orderId']);
        if (! $order) {
            return $this->error('Pedido no encontrado', 404);
        }
        if ($order->userId !== null && $order->userId !== $request->user()->id) {
            return $this->error('Pedido no encontrado', 404);
        }

        $result = $this->mercadoPago->createPreference($order);
        if (! ($result['success'] ?? false)) {
            return $this->error($result['message'] ?? 'No se pudo crear la preferencia', 400);
        }

        return $this->success($result, 'Preferencia creada');
    }

    private function fail(RuntimeException $e)
    {
        return $this->error($e->getMessage(), $e->getCode() === 404 ? 404 : 400);
    }

    // ==================== USUARIO ====================

    public function store(Request $request)
    {
        $data = $request->validate([
            'orderId' => 'required|integer',
            'transactionId' => 'nullable|string',
            'paymentMethod' => 'required|string',
            'amount' => 'required|numeric|min:0',
            'currency' => 'nullable|string',
            'payerName' => 'nullable|string',
            'payerEmail' => 'nullable|string',
            'payerPhone' => 'nullable|string',
            'payerDocument' => 'nullable|string',
        ]);

        try {
            $payment = $this->payments->createPayment($data);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->created($this->payments->formatPayment($payment), 'Pago iniciado exitosamente');
    }

    public function myOrderPayments(Request $request, int $orderId)
    {
        $order = Order::find($orderId);
        if (! $order || $order->userId !== $request->user()->id) {
            return $this->error('Pedido no encontrado', 404);
        }

        return $this->success($this->payments->getByOrderId($orderId));
    }

    public function updateMyPayment(Request $request, int $id)
    {
        $payment = Payment::with('order')->find($id);
        if (! $payment || $payment->order?->userId !== $request->user()->id) {
            return $this->error('Pago no encontrado', 404);
        }

        $data = $request->validate([
            'receiptUrl' => 'nullable|string',
            'receiptData' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        try {
            $updated = $this->payments->updatePayment($id, $data);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->success($this->payments->formatPayment($updated), 'Pago actualizado exitosamente');
    }

    // ==================== ADMIN ====================

    public function stats()
    {
        return $this->success($this->payments->getStats());
    }

    public function index(Request $request)
    {
        return response()->json(['success' => true] + $this->payments->listPayments($request->query()));
    }

    public function orderPayments(int $orderId)
    {
        return $this->success($this->payments->getByOrderId($orderId));
    }

    public function show(int $id)
    {
        try {
            return $this->success($this->payments->formatPayment($this->payments->getById($id)));
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }
    }

    public function showByTransaction(string $transactionId)
    {
        try {
            return $this->success($this->payments->formatPayment($this->payments->getByTransactionId($transactionId)));
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }
    }

    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in(['PENDING', 'PROCESSING', 'APPROVED', 'DECLINED', 'FAILED', 'CANCELLED', 'EXPIRED'])],
            'transactionId' => 'nullable|string',
            'receiptUrl' => 'nullable|string',
            'receiptData' => 'nullable|string',
            'failureReason' => 'nullable|string',
            'failureCode' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        try {
            $payment = $this->payments->updatePayment($id, $data);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->success($this->payments->formatPayment($payment), 'Pago actualizado exitosamente');
    }

    public function verify(Request $request, int $id)
    {
        $data = $request->validate([
            'approved' => 'required|boolean',
            'notes' => 'nullable|string',
        ]);

        try {
            $payment = $this->payments->verifyPayment($id, $request->user()->id, $data['approved'], $data['notes'] ?? null);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->success($this->payments->formatPayment($payment), 'Pago verificado exitosamente');
    }

    public function refund(Request $request, int $id)
    {
        $data = $request->validate([
            'amount' => 'nullable|numeric|min:0',
            'reason' => 'required|string',
        ]);

        try {
            $payment = $this->payments->refundPayment($id, $data['amount'] ?? null, $data['reason']);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->success($this->payments->formatPayment($payment), 'Reembolso procesado exitosamente');
    }

    public function cancel(Request $request, int $id)
    {
        $data = $request->validate(['reason' => 'nullable|string']);

        try {
            $payment = $this->payments->cancelPayment($id, $data['reason'] ?? null);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->success($this->payments->formatPayment($payment), 'Pago cancelado exitosamente');
    }
}
