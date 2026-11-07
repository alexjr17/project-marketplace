<?php

namespace App\Services\Pos;

use App\Exceptions\BusinessRuleException;
use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * Cajas registradoras y sesiones de caja del POS: apertura, cierre con cuadre y reporte.
 *
 * Cuadre (efectivo esperado) = base inicial + efectivo que entró con las ventas de la sesión:
 *   - venta en efectivo pagada → su total (el vuelto no se queda en la caja);
 *   - venta mixta → su parte en efectivo (cashAmount);
 *   - fiado → lo abonado en efectivo (cashAmount), esté saldado o no.
 * Antes solo contaba las ventas "cash" por su total: la parte en efectivo de las mixtas y los
 * fiados cobrados en efectivo quedaban como sobrante.
 */
class CashSessionService
{
    /** Estados de una venta que cuenta como venta de la sesión (los fiados pendientes no). */
    private const SOLD = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

    // ---- cajas ----

    public function registers(bool $activeOnly): Collection
    {
        return CashRegister::with(['cashSessions' => fn ($q) => $q->where('status', 'OPEN')->with('seller:id,name,email')])
            ->when($activeOnly, fn ($q) => $q->where('isActive', true))
            ->orderBy('name')->get();
    }

    public function register(int $id): CashRegister
    {
        $register = CashRegister::with(['cashSessions' => fn ($q) => $q->orderByDesc('openedAt')->take(10)->with('seller:id,name,email')])->find($id);
        if (! $register) {
            throw new BusinessRuleException('Caja registradora no encontrada', 404);
        }

        return $register;
    }

    public function createRegister(array $data): CashRegister
    {
        if (CashRegister::where('code', $data['code'])->exists()) {
            throw new BusinessRuleException('Ya existe una caja registradora con este código', 400);
        }

        return CashRegister::create([
            'name' => $data['name'],
            'location' => $data['location'],
            'code' => $data['code'],
            'categoryIds' => $data['categoryIds'] ?? [],
            'isActive' => true,
        ]);
    }

    public function updateRegister(int $id, array $data): CashRegister
    {
        $register = $this->findRegister($id);
        if (isset($data['code']) && $data['code'] !== $register->code
            && CashRegister::where('code', $data['code'])->exists()) {
            throw new BusinessRuleException('Ya existe una caja registradora con este código', 400);
        }
        $register->fill($data)->save();

        return $register;
    }

    public function deleteRegister(int $id): void
    {
        $register = $this->findRegister($id);
        if (CashSession::where('cashRegisterId', $id)->where('status', 'OPEN')->exists()) {
            throw new BusinessRuleException('No se puede eliminar una caja con sesiones abiertas', 400);
        }
        $register->delete();
    }

    // ---- sesiones ----

    public function mySession(int $userId): CashSession
    {
        $session = CashSession::with(['cashRegister', 'seller:id,name,email'])
            ->where('sellerId', $userId)->where('status', 'OPEN')->first();
        if (! $session) {
            throw new BusinessRuleException('No tienes una sesión activa', 404);
        }

        return $session;
    }

    /**
     * Abre una sesión en la caja. Un cajero tiene una sola sesión abierta a la vez: antes podía
     * abrir dos cajas y el POS vendía en la primera que encontraba.
     */
    public function open(int $registerId, User $user, array $data): CashSession
    {
        $register = CashRegister::find($registerId);
        if (! $register) {
            throw new BusinessRuleException('Caja registradora no encontrada', 404);
        }
        if (! $register->isActive) {
            throw new BusinessRuleException('La caja registradora no está activa', 400);
        }
        if (CashSession::where('cashRegisterId', $registerId)->where('status', 'OPEN')->exists()) {
            throw new BusinessRuleException('Ya existe una sesión abierta en esta caja', 400);
        }
        $other = CashSession::with('cashRegister:id,name')->where('sellerId', $user->id)->where('status', 'OPEN')->first();
        if ($other) {
            throw new BusinessRuleException('Ya tienes una sesión abierta en la caja '.($other->cashRegister?->name ?? $other->cashRegisterId).'. Ciérrala antes de abrir otra.', 400);
        }

        $session = CashSession::create([
            'cashRegisterId' => $registerId,
            'sellerId' => $user->id,
            'initialCash' => $data['initialCash'],
            'openedAt' => now(),
            'status' => 'OPEN',
            'notes' => $data['notes'] ?? null,
            'salesCount' => 0,
            'totalSales' => 0,
        ]);

        return $session->load(['cashRegister', 'seller:id,name,email']);
    }

    /** 404 si la sesión no existe (se revisa antes de validar el cuerpo, como siempre). */
    public function findSession(int $id): CashSession
    {
        $session = CashSession::with('cashRegister')->find($id);
        if (! $session) {
            throw new BusinessRuleException('Sesión no encontrada', 404);
        }

        return $session;
    }

    /** Cierra la sesión con el cuadre. Cada cajero cierra la suya; el SuperAdmin, cualquiera. */
    public function close(int $id, User $user, array $data): CashSession
    {
        $session = $this->findSession($id);
        if ($session->status === 'CLOSED') {
            throw new BusinessRuleException('La sesión ya está cerrada', 400);
        }
        if ((int) $session->sellerId !== (int) $user->id && (int) $user->roleId !== 1) {
            throw new BusinessRuleException('Solo puedes cerrar tu propia sesión de caja', 403);
        }

        $orders = $this->sessionOrders($session)->get();
        $sales = $orders->filter(fn ($o) => in_array($o->status, self::SOLD, true));
        $expectedCash = (float) $session->initialCash + $this->cashIn($orders);

        $session->closedAt = now();
        $session->finalCash = $data['finalCash'];
        $session->expectedCash = $expectedCash;
        $session->difference = $data['finalCash'] - $expectedCash;
        $session->salesCount = $sales->count();
        $session->totalSales = $sales->sum(fn ($o) => (float) $o->total);
        $session->status = 'CLOSED';
        if (! empty($data['notes'])) {
            $session->notes = trim(($session->notes ?? '')."\n".$data['notes']);
        }
        $session->save();

        return $session->load(['cashRegister', 'seller:id,name,email']);
    }

    /** @param array{cashRegisterId?:?int, sellerId?:?int, status?:?string, dateFrom?:?string, dateTo?:?string} $filters */
    public function sessions(array $filters): Collection
    {
        return CashSession::with(['cashRegister', 'seller:id,name,email'])
            ->when($filters['cashRegisterId'] ?? null, fn ($q, $v) => $q->where('cashRegisterId', $v))
            ->when($filters['sellerId'] ?? null, fn ($q, $v) => $q->where('sellerId', $v))
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($filters['dateFrom'] ?? null, fn ($q, $v) => $q->where('openedAt', '>=', $v))
            ->when($filters['dateTo'] ?? null, fn ($q, $v) => $q->where('openedAt', '<=', $v))
            ->orderByDesc('openedAt')->get();
    }

    /**
     * Reporte de la sesión: lista TODAS sus ventas (también las anuladas, para verlas), pero el
     * resumen solo suma las ventas efectivas, igual que el cierre (antes sumaba las anuladas).
     */
    public function report(int $id): array
    {
        $session = CashSession::with(['cashRegister', 'seller:id,name,email'])->find($id);
        if (! $session) {
            throw new BusinessRuleException('Sesión no encontrada', 404);
        }

        $query = $this->sessionOrders($session)->with('user:id,name,email');
        if ($session->closedAt) {
            $query->where('createdAt', '<=', $session->closedAt);
        }
        $orders = $query->orderByDesc('createdAt')->get();
        $sales = $orders->filter(fn ($o) => in_array($o->status, self::SOLD, true));

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

        return [
            'session' => $session,
            'sales' => $orders->values(),
            'summary' => [
                'totalSales' => $sales->count(),
                'totalAmount' => $sales->sum(fn ($o) => (float) $o->total),
                'paymentMethods' => (object) $paymentMethods,
                'duration' => $duration,
            ],
        ];
    }

    // ---- reglas internas ----

    private function findRegister(int $id): CashRegister
    {
        $register = CashRegister::find($id);
        if (! $register) {
            throw new BusinessRuleException('Caja registradora no encontrada', 404);
        }

        return $register;
    }

    /** Ventas de la sesión: misma caja y cajero, desde la apertura. */
    private function sessionOrders(CashSession $session)
    {
        return Order::where('cashRegisterId', $session->cashRegisterId)
            ->where('sellerId', $session->sellerId)
            ->where('createdAt', '>=', $session->openedAt);
    }

    /** Efectivo que entró a la caja con las ventas de la sesión (ver cuadre en la clase). */
    private function cashIn($orders): float
    {
        $cash = 0.0;
        foreach ($orders as $o) {
            if ($o->status === 'CANCELLED') {
                continue;
            }
            $method = $o->paymentMethod;
            if (in_array($method, ['cash', 'efectivo'], true)) {
                $cash += in_array($o->status, self::SOLD, true) ? (float) $o->total : 0.0;
            } elseif (in_array($method, ['mixed', 'debe'], true)) {
                $cash += (float) ($o->cashAmount ?? 0);
            }
        }

        return $cash;
    }
}
