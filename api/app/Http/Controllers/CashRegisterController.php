<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Order;
use Illuminate\Http\Request;

class CashRegisterController extends Controller
{
    use ApiResponse;

    /** GET /api/cash-registers */
    public function index(Request $request)
    {
        $query = CashRegister::with(['cashSessions' => function ($q) {
            $q->where('status', 'OPEN')->with('seller:id,name,email');
        }]);

        if ($request->query('activeOnly') === 'true') {
            $query->where('isActive', true);
        }

        return $this->success($query->orderBy('name')->get());
    }

    /** GET /api/cash-registers/my-session */
    public function mySession(Request $request)
    {
        $session = CashSession::with(['cashRegister', 'seller:id,name,email'])
            ->where('sellerId', $request->user()->id)
            ->where('status', 'OPEN')
            ->first();

        if (! $session) {
            return $this->error('No tienes una sesión activa', 404);
        }

        return $this->success($session);
    }

    /** GET /api/cash-registers/{id} */
    public function show(int $id)
    {
        $cashRegister = CashRegister::with(['cashSessions' => function ($q) {
            $q->orderByDesc('openedAt')->take(10)->with('seller:id,name,email');
        }])->find($id);

        if (! $cashRegister) {
            return $this->error('Caja registradora no encontrada', 404);
        }

        return $this->success($cashRegister);
    }

    /** POST /api/cash-registers */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'location' => 'required|string',
            'code' => 'required|string',
        ]);

        if (CashRegister::where('code', $data['code'])->exists()) {
            return $this->error('Ya existe una caja registradora con este código', 400);
        }

        $cashRegister = CashRegister::create([
            'name' => $data['name'],
            'location' => $data['location'],
            'code' => $data['code'],
            'isActive' => true,
        ]);

        return $this->created($cashRegister, 'Caja registradora creada exitosamente');
    }

    /** PATCH /api/cash-registers/{id} */
    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'name' => 'sometimes|string',
            'location' => 'sometimes|string',
            'code' => 'sometimes|string',
            'isActive' => 'sometimes|boolean',
        ]);

        $cashRegister = CashRegister::find($id);
        if (! $cashRegister) {
            return $this->error('Caja registradora no encontrada', 404);
        }

        if (isset($data['code']) && $data['code'] !== $cashRegister->code
            && CashRegister::where('code', $data['code'])->exists()) {
            return $this->error('Ya existe una caja registradora con este código', 400);
        }

        $cashRegister->fill($data)->save();

        return $this->success($cashRegister, 'Caja registradora actualizada exitosamente');
    }

    /** DELETE /api/cash-registers/{id} */
    public function destroy(int $id)
    {
        $cashRegister = CashRegister::find($id);
        if (! $cashRegister) {
            return $this->error('Caja registradora no encontrada', 404);
        }

        $hasOpen = CashSession::where('cashRegisterId', $id)->where('status', 'OPEN')->exists();
        if ($hasOpen) {
            return $this->error('No se puede eliminar una caja con sesiones abiertas', 400);
        }

        $cashRegister->delete();

        return $this->success(null, 'Caja registradora eliminada exitosamente');
    }

    /** POST /api/cash-registers/{id}/open-session */
    public function openSession(Request $request, int $id)
    {
        $data = $request->validate([
            'initialCash' => 'required|numeric',
            'notes' => 'nullable|string',
        ]);

        $cashRegister = CashRegister::find($id);
        if (! $cashRegister) {
            return $this->error('Caja registradora no encontrada', 404);
        }
        if (! $cashRegister->isActive) {
            return $this->error('La caja registradora no está activa', 400);
        }

        $hasOpen = CashSession::where('cashRegisterId', $id)->where('status', 'OPEN')->exists();
        if ($hasOpen) {
            return $this->error('Ya existe una sesión abierta en esta caja', 400);
        }

        $session = CashSession::create([
            'cashRegisterId' => $id,
            'sellerId' => $request->user()->id,
            'initialCash' => $data['initialCash'],
            'openedAt' => now(),
            'status' => 'OPEN',
            'notes' => $data['notes'] ?? null,
            'salesCount' => 0,
            'totalSales' => 0,
        ]);

        return $this->created(
            $session->load(['cashRegister', 'seller:id,name,email']),
            'Sesión abierta exitosamente'
        );
    }

    /** POST /api/cash-registers/sessions/{id}/close */
    public function closeSession(Request $request, int $id)
    {
        $data = $request->validate([
            'finalCash' => 'required|numeric',
            'notes' => 'nullable|string',
        ]);

        $session = CashSession::with('cashRegister')->find($id);
        if (! $session) {
            return $this->error('Sesión no encontrada', 404);
        }
        if ($session->status === 'CLOSED') {
            return $this->error('La sesión ya está cerrada', 400);
        }

        $sales = Order::where('cashRegisterId', $session->cashRegisterId)
            ->where('sellerId', $session->sellerId)
            ->where('createdAt', '>=', $session->openedAt)
            ->whereIn('status', ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'])
            ->get();

        $salesCount = $sales->count();
        $totalSales = $sales->sum(fn ($o) => (float) $o->total);
        $totalCashSales = $sales
            ->filter(fn ($o) => in_array($o->paymentMethod, ['cash', 'efectivo'], true))
            ->sum(fn ($o) => (float) $o->total);

        $expectedCash = (float) $session->initialCash + $totalCashSales;

        $session->closedAt = now();
        $session->finalCash = $data['finalCash'];
        $session->expectedCash = $expectedCash;
        $session->difference = $data['finalCash'] - $expectedCash;
        $session->salesCount = $salesCount;
        $session->totalSales = $totalSales;
        $session->status = 'CLOSED';
        if (! empty($data['notes'])) {
            $session->notes = trim(($session->notes ?? '')."\n".$data['notes']);
        }
        $session->save();

        return $this->success(
            $session->load(['cashRegister', 'seller:id,name,email']),
            'Sesión cerrada exitosamente'
        );
    }

    /** GET /api/cash-registers/sessions */
    public function listSessions(Request $request)
    {
        $query = CashSession::with(['cashRegister', 'seller:id,name,email']);

        if ($request->filled('cashRegisterId')) {
            $query->where('cashRegisterId', (int) $request->query('cashRegisterId'));
        }
        if ($request->filled('sellerId')) {
            $query->where('sellerId', (int) $request->query('sellerId'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->filled('dateFrom')) {
            $query->where('openedAt', '>=', $request->query('dateFrom'));
        }
        if ($request->filled('dateTo')) {
            $query->where('openedAt', '<=', $request->query('dateTo'));
        }

        return $this->success($query->orderByDesc('openedAt')->get());
    }

    /** GET /api/cash-registers/sessions/{id}/report */
    public function sessionReport(int $id)
    {
        $session = CashSession::with(['cashRegister', 'seller:id,name,email'])->find($id);
        if (! $session) {
            return $this->error('Sesión no encontrada', 404);
        }

        $salesQuery = Order::with('user:id,name,email')
            ->where('cashRegisterId', $session->cashRegisterId)
            ->where('sellerId', $session->sellerId)
            ->where('createdAt', '>=', $session->openedAt);
        if ($session->closedAt) {
            $salesQuery->where('createdAt', '<=', $session->closedAt);
        }
        $sales = $salesQuery->orderByDesc('createdAt')->get();

        $paymentMethods = [];
        foreach ($sales as $order) {
            $method = $order->paymentMethod ?: 'unknown';
            $paymentMethods[$method] ??= ['count' => 0, 'total' => 0];
            $paymentMethods[$method]['count']++;
            $paymentMethods[$method]['total'] += (float) $order->total;
        }

        $duration = null;
        if ($session->closedAt && $session->openedAt) {
            $duration = (int) round($session->openedAt->diffInSeconds($session->closedAt) / 60);
        }

        return $this->success([
            'session' => $session,
            'sales' => $sales,
            'summary' => [
                'totalSales' => $sales->count(),
                'totalAmount' => $sales->sum(fn ($o) => (float) $o->total),
                'paymentMethods' => (object) $paymentMethods,
                'duration' => $duration,
            ],
        ]);
    }
}
