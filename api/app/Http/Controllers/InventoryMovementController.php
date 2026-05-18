<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\ProductVariant;
use App\Models\VariantMovement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryMovementController extends Controller
{
    use ApiResponse;

    private const MOVEMENT_TYPES = [
        'PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER_IN',
        'TRANSFER_OUT', 'RETURN', 'DAMAGE', 'INITIAL',
    ];

    /** Relaciones del movimiento para la lista general. */
    private const MOVEMENT_RELATIONS = [
        'variant:id,sku,productId,colorId,sizeId',
        'variant.product:id,name,sku',
        'variant.color:id,name,hexCode',
        'variant.size:id,name,abbreviation',
    ];

    /** GET /api/inventory/movements */
    public function movements(Request $request)
    {
        $query = VariantMovement::with(self::MOVEMENT_RELATIONS);

        if ($request->filled('variantId')) {
            $query->where('variantId', (int) $request->query('variantId'));
        }
        if ($request->filled('productId')) {
            $productId = (int) $request->query('productId');
            $query->whereHas('variant', fn ($q) => $q->where('productId', $productId));
        }
        if ($request->filled('movementType')) {
            $query->where('movementType', $request->query('movementType'));
        }
        if ($request->filled('fromDate')) {
            $query->where('createdAt', '>=', $request->query('fromDate'));
        }
        if ($request->filled('toDate')) {
            $query->where('createdAt', '<=', $request->query('toDate'));
        }
        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('reason', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%")
                    ->orWhereHas('variant', fn ($v) => $v->where('sku', 'like', "%{$search}%"))
                    ->orWhereHas('variant.product', fn ($p) => $p->where('name', 'like', "%{$search}%"));
            });
        }

        $movements = $query->orderByDesc('createdAt')->limit(500)->get();

        return $this->success($movements);
    }

    /** GET /api/inventory/movements/variant/{variantId} */
    public function variantMovements(int $variantId)
    {
        return $this->success(
            VariantMovement::where('variantId', $variantId)->orderByDesc('createdAt')->get()
        );
    }

    /** POST /api/inventory/movements */
    public function createMovement(Request $request)
    {
        $data = $request->validate([
            'variantId' => 'required|integer',
            'movementType' => 'required|in:'.implode(',', self::MOVEMENT_TYPES),
            'quantity' => 'required|numeric',
            'reason' => 'nullable|string',
            'notes' => 'nullable|string',
            'referenceType' => 'nullable|string',
            'referenceId' => 'nullable|integer',
            'unitCost' => 'nullable|numeric',
        ]);
        $data['userId'] = $request->user()->id;

        try {
            $movement = $this->registerMovement($data);
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return $this->created($movement, 'Movimiento registrado correctamente');
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

        $userId = $request->user()->id;
        $results = [];

        foreach ($data['items'] as $item) {
            $variant = ProductVariant::find($item['variantId']);
            if (! $variant) {
                $results[] = ['variantId' => $item['variantId'], 'error' => 'Variante no encontrada'];

                continue;
            }

            $difference = $item['newStock'] - $variant->stock;
            if ($difference === 0) {
                $results[] = ['variantId' => $item['variantId'], 'message' => 'Sin cambios'];

                continue;
            }

            try {
                $movement = $this->registerMovement([
                    'variantId' => $item['variantId'],
                    'movementType' => 'ADJUSTMENT',
                    'quantity' => $difference,
                    'reason' => $item['reason'] ?? 'Ajuste masivo de inventario',
                    'userId' => $userId,
                ]);
                $results[] = ['variantId' => $item['variantId'], 'success' => true, 'movement' => $movement];
            } catch (\RuntimeException $e) {
                $results[] = ['variantId' => $item['variantId'], 'error' => $e->getMessage()];
            }
        }

        return $this->success($results, 'Ajuste masivo completado');
    }

    /** GET /api/inventory/summary */
    public function summary(Request $request)
    {
        $query = VariantMovement::query();
        if ($request->filled('fromDate')) {
            $query->where('createdAt', '>=', $request->query('fromDate'));
        }
        if ($request->filled('toDate')) {
            $query->where('createdAt', '<=', $request->query('toDate'));
        }

        $summary = $query->groupBy('movementType')
            ->select('movementType', DB::raw('COUNT(*) as _count'), DB::raw('SUM(quantity) as quantitySum'))
            ->get()
            ->map(fn ($row) => [
                'movementType' => $row->movementType,
                '_count' => (int) $row->_count,
                '_sum' => ['quantity' => (int) $row->quantitySum],
            ]);

        return $this->success($summary);
    }

    /** GET /api/inventory/low-stock */
    public function lowStock()
    {
        $variants = ProductVariant::with([
            'product:id,name,sku',
            'color:id,name,hexCode',
            'size:id,name,abbreviation',
        ])
            ->where('isActive', true)
            ->whereColumn('stock', '<=', 'minStock')
            ->orderBy('stock')
            ->get();

        return $this->success($variants);
    }

    /** GET /api/inventory/stats */
    public function stats()
    {
        $totalVariants = ProductVariant::where('isActive', true)->count();
        $outOfStock = ProductVariant::where('isActive', true)->where('stock', 0)->count();
        $totalStock = (int) ProductVariant::where('isActive', true)->sum('stock');
        $lowStock = ProductVariant::where('isActive', true)
            ->where('minStock', '>', 0)
            ->where('stock', '>', 0)
            ->whereColumn('stock', '<=', 'minStock')
            ->count();

        $todayMovements = VariantMovement::where('createdAt', '>=', now()->startOfDay())->count();

        return $this->success([
            'totalVariants' => $totalVariants,
            'lowStock' => $lowStock,
            'outOfStock' => $outOfStock,
            'totalStock' => $totalStock,
            'todayMovements' => $todayMovements,
        ]);
    }

    /** Registra un movimiento y actualiza el stock de la variante en transacción. */
    private function registerMovement(array $data): VariantMovement
    {
        $variant = ProductVariant::find($data['variantId']);
        if (! $variant) {
            throw new \RuntimeException('Variante no encontrada');
        }

        $previousStock = (int) $variant->stock;
        $quantity = $data['quantity'];
        $type = $data['movementType'];

        $newStock = match ($type) {
            'PURCHASE', 'TRANSFER_IN', 'RETURN', 'INITIAL' => $previousStock + $quantity,
            'SALE', 'TRANSFER_OUT', 'DAMAGE' => $previousStock - $quantity,
            'ADJUSTMENT' => $previousStock + $quantity,
            default => $previousStock,
        };

        if ($newStock < 0) {
            $msg = $type === 'ADJUSTMENT'
                ? 'El ajuste resultaría en stock negativo'
                : "Stock insuficiente. Stock actual: {$previousStock}";
            throw new \RuntimeException($msg);
        }

        return DB::transaction(function () use ($variant, $data, $type, $quantity, $previousStock, $newStock) {
            $variant->stock = $newStock;
            $variant->save();

            return VariantMovement::create([
                'variantId' => $data['variantId'],
                'movementType' => $type,
                'quantity' => $type === 'ADJUSTMENT' ? $quantity : abs($quantity),
                'previousStock' => $previousStock,
                'newStock' => $newStock,
                'reason' => $data['reason'] ?? null,
                'notes' => $data['notes'] ?? null,
                'userId' => $data['userId'] ?? null,
                'referenceType' => $data['referenceType'] ?? null,
                'referenceId' => $data['referenceId'] ?? null,
                'unitCost' => $data['unitCost'] ?? null,
            ])->load([
                'variant.product:id,name',
                'variant.color:id,name',
                'variant.size:id,name',
            ]);
        });
    }
}
