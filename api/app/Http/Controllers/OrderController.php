<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\OrderService;
use App\Services\WompiService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class OrderController extends Controller
{
    use ApiResponse;

    public function __construct(
        private OrderService $orders,
        private WompiService $wompi,
    ) {}

    private const STATUSES = ['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

    /** Convierte una RuntimeException del servicio en respuesta de error. */
    private function fail(RuntimeException $e)
    {
        $status = $e->getCode() === 404 ? 404 : 400;

        return $this->error($e->getMessage(), $status);
    }

    // ==================== USUARIO ====================

    public function store(Request $request)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.productId' => 'required|integer',
            'items.*.size' => 'required|string',
            'items.*.color' => 'required|string',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.customization' => 'nullable',
            'shipping' => 'required|array',
            'paymentMethod' => 'required|string',
            'paymentRef' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        try {
            $order = $this->orders->createOrder($request->user()->id, $data);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->created($this->orders->formatOrder($order), 'Pedido creado exitosamente');
    }

    public function myOrders(Request $request)
    {
        $result = $this->orders->listOrders($request->query() + ['userId' => $request->user()->id]);

        return response()->json(['success' => true] + $result);
    }

    public function myOrderById(Request $request, int $id)
    {
        try {
            $order = $this->orders->getOrderById($id, $request->user()->id);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->success($this->orders->formatOrder($order));
    }

    public function myOrderByNumber(Request $request, string $orderNumber)
    {
        try {
            $order = $this->orders->getOrderByNumber($orderNumber, $request->user()->id);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->success($this->orders->formatOrder($order));
    }

    public function cancelMyOrder(Request $request, int $id)
    {
        try {
            $order = $this->orders->cancelOrder($id, $request->user()->id);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->success($this->orders->formatOrder($order), 'Pedido cancelado exitosamente');
    }

    public function confirmPayment(Request $request, string $orderNumber)
    {
        $data = $request->validate(['transactionId' => 'required|string']);

        try {
            $order = $this->orders->getOrderByNumber($orderNumber, $request->user()->id);
        } catch (RuntimeException $e) {
            return $this->error('Orden no encontrada', 404);
        }

        if ($order->status === 'PAID') {
            return $this->success($this->orders->formatOrder($order), 'El pedido ya está pagado');
        }

        $result = $this->wompi->confirmPaymentByTransaction($data['transactionId'], $orderNumber);
        if (! $result['success']) {
            return response()->json([
                'success' => false,
                'message' => $result['message'],
                'status' => $result['status'] ?? null,
            ], 400);
        }

        $updated = $this->orders->getOrderByNumber($orderNumber, $request->user()->id);

        return $this->success($this->orders->formatOrder($updated), $result['message']);
    }

    // ==================== ADMIN ====================

    public function index(Request $request)
    {
        return response()->json(['success' => true] + $this->orders->listOrders($request->query()));
    }

    public function show(int $id)
    {
        try {
            $order = $this->orders->getOrderById($id);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->success($this->orders->formatOrder($order));
    }

    public function showByNumber(string $orderNumber)
    {
        try {
            $order = $this->orders->getOrderByNumber($orderNumber);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->success($this->orders->formatOrder($order));
    }

    public function updateStatus(Request $request, int $id)
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(self::STATUSES)],
            'trackingNumber' => 'nullable|string',
            'trackingUrl' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        try {
            $order = $this->orders->updateOrderStatus($id, $data);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->success($this->orders->formatOrder($order), 'Estado del pedido actualizado');
    }

    public function stats()
    {
        return $this->success($this->orders->getStats());
    }
}
