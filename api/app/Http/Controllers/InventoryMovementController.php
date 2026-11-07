<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Inventory\InventoryMovementService;
use Illuminate\Http\Request;

/** Movimientos de stock de variantes de producto. La lógica vive en InventoryMovementService. */
class InventoryMovementController extends Controller
{
    use ApiResponse;

    public function __construct(private InventoryMovementService $movements) {}

    /** GET /api/inventory/movements */
    public function movements(Request $request)
    {
        return $this->success($this->movements->list($request->query()));
    }

    /** GET /api/inventory/movements/variant/{variantId} */
    public function variantMovements(int $variantId)
    {
        return $this->success($this->movements->forVariant($variantId));
    }

    /** POST /api/inventory/movements */
    public function createMovement(Request $request)
    {
        $data = $request->validate([
            'variantId' => 'required|integer',
            'movementType' => 'required|in:'.implode(',', InventoryMovementService::TYPES),
            'quantity' => 'required|numeric',
            'reason' => 'nullable|string',
            'notes' => 'nullable|string',
            'referenceType' => 'nullable|string',
            'referenceId' => 'nullable|integer',
            'unitCost' => 'nullable|numeric',
        ]);
        $data['userId'] = $request->user()->id;

        return $this->created($this->movements->register($data), 'Movimiento registrado correctamente');
    }

    /** POST /api/inventory/bulk-adjustment */
    public function bulkAdjustment(Request $request)
    {
        $data = $request->validate([
            'items' => 'required|array',
            'items.*.variantId' => 'required|integer',
            'items.*.newStock' => 'required|integer',
            'items.*.reason' => 'nullable|string',
        ]);

        return $this->success($this->movements->bulkAdjust($data['items'], $request->user()->id), 'Ajuste masivo completado');
    }

    /** GET /api/inventory/summary */
    public function summary(Request $request)
    {
        return $this->success($this->movements->summary($request->query()));
    }

    /** GET /api/inventory/low-stock */
    public function lowStock()
    {
        return $this->success($this->movements->lowStock());
    }

    /** GET /api/inventory/stats */
    public function stats()
    {
        return $this->success($this->movements->stats());
    }
}
