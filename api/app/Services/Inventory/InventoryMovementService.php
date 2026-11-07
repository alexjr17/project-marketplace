<?php

namespace App\Services\Inventory;

use App\Exceptions\BusinessRuleException;
use App\Exceptions\InsufficientStockException;
use App\Models\ProductVariant;
use App\Models\VariantMovement;
use App\Services\StockService;
use Illuminate\Support\Facades\DB;

/**
 * Movimientos manuales del stock de variantes de producto (entradas, salidas y ajustes desde
 * el panel) y sus consultas. El stock se mueve SIEMPRE con StockService (bloqueo de fila y
 * movimiento con el stock anterior real) y después se recalcula products.stock.
 *
 * La cantidad del movimiento queda con signo (+ entra, − sale), igual que las ventas POS y
 * los pedidos; las pantallas la muestran en valor absoluto con el tipo.
 */
class InventoryMovementService
{
    public const TYPES = ['PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN', 'DAMAGE', 'INITIAL'];

    private const INCOMING = ['PURCHASE', 'TRANSFER_IN', 'RETURN', 'INITIAL'];

    private const LIST_RELATIONS = [
        'variant:id,sku,productId,colorId,sizeId',
        'variant.product:id,name,sku',
        'variant.color:id,name,hexCode',
        'variant.size:id,name,abbreviation',
    ];

    public function __construct(private StockService $stock) {}

    public function list(array $filters)
    {
        $query = VariantMovement::with(self::LIST_RELATIONS);

        if (! empty($filters['variantId'])) {
            $query->where('variantId', (int) $filters['variantId']);
        }
        if (! empty($filters['productId'])) {
            $productId = (int) $filters['productId'];
            $query->whereHas('variant', fn ($q) => $q->where('productId', $productId));
        }
        if (! empty($filters['movementType'])) {
            $query->where('movementType', $filters['movementType']);
        }
        if (! empty($filters['fromDate'])) {
            $query->where('createdAt', '>=', $filters['fromDate']);
        }
        if (! empty($filters['toDate'])) {
            $query->where('createdAt', '<=', $filters['toDate']);
        }
        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('reason', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%")
                    ->orWhereHas('variant', fn ($v) => $v->where('sku', 'like', "%{$search}%"))
                    ->orWhereHas('variant.product', fn ($p) => $p->where('name', 'like', "%{$search}%"));
            });
        }

        return $query->orderByDesc('createdAt')->limit(500)->get();
    }

    public function forVariant(int $variantId)
    {
        return VariantMovement::where('variantId', $variantId)->orderByDesc('createdAt')->get();
    }

    /**
     * Registra un movimiento manual. En ADJUSTMENT la cantidad lleva el signo del ajuste;
     * en los demás tipos la dirección la da el tipo y la cantidad no puede ser negativa
     * (antes una SALE con −2 sumaba stock).
     */
    public function register(array $data): VariantMovement
    {
        $type = $data['movementType'];
        $quantity = $data['quantity'];
        if ($type !== 'ADJUSTMENT' && $quantity < 0) {
            throw new BusinessRuleException('La cantidad no puede ser negativa; el tipo de movimiento indica si entra o sale', 422, [
                'quantity' => ['La cantidad no puede ser negativa'],
            ]);
        }

        $variant = ProductVariant::find($data['variantId']);
        if (! $variant) {
            throw new BusinessRuleException('Variante no encontrada', 400);
        }

        $attrs = [
            'reason' => $data['reason'] ?? null,
            'notes' => $data['notes'] ?? null,
            'userId' => $data['userId'] ?? null,
            'referenceType' => $data['referenceType'] ?? null,
            'referenceId' => $data['referenceId'] ?? null,
            'unitCost' => $data['unitCost'] ?? null,
        ];
        $incoming = in_array($type, self::INCOMING, true) || ($type === 'ADJUSTMENT' && $quantity >= 0);

        try {
            $movement = DB::transaction(function () use ($variant, $type, $quantity, $attrs, $incoming) {
                $movement = $incoming
                    ? $this->stock->variantIn($variant->id, abs($quantity), $type, $attrs)
                    : $this->stock->variantOut($variant->id, abs($quantity), $type, $attrs);
                $this->stock->syncProductStock((int) $variant->productId);

                return $movement;
            });
        } catch (InsufficientStockException $e) {
            throw new BusinessRuleException($type === 'ADJUSTMENT'
                ? 'El ajuste resultaría en stock negativo'
                : 'Stock insuficiente. Stock actual: '.(int) $e->available, 400);
        }

        return $movement->load(['variant.product:id,name', 'variant.color:id,name', 'variant.size:id,name']);
    }

    /** Ajuste masivo: fija el stock de cada variante y reporta el resultado por ítem. */
    public function bulkAdjust(array $items, int $userId): array
    {
        $results = [];
        foreach ($items as $item) {
            $variant = ProductVariant::find($item['variantId']);
            if (! $variant) {
                $results[] = ['variantId' => $item['variantId'], 'error' => 'Variante no encontrada'];

                continue;
            }

            $difference = $item['newStock'] - (int) $variant->stock;
            if ($difference === 0) {
                $results[] = ['variantId' => $item['variantId'], 'message' => 'Sin cambios'];

                continue;
            }

            try {
                $movement = $this->register([
                    'variantId' => $item['variantId'],
                    'movementType' => 'ADJUSTMENT',
                    'quantity' => $difference,
                    'reason' => $item['reason'] ?? 'Ajuste masivo de inventario',
                    'userId' => $userId,
                ]);
                $results[] = ['variantId' => $item['variantId'], 'success' => true, 'movement' => $movement];
            } catch (BusinessRuleException $e) {
                $results[] = ['variantId' => $item['variantId'], 'error' => $e->getMessage()];
            }
        }

        return $results;
    }

    /** Resumen por tipo. La suma es en valor absoluto: los movimientos guardan la cantidad con signo. */
    public function summary(array $filters)
    {
        $query = VariantMovement::query();
        if (! empty($filters['fromDate'])) {
            $query->where('createdAt', '>=', $filters['fromDate']);
        }
        if (! empty($filters['toDate'])) {
            $query->where('createdAt', '<=', $filters['toDate']);
        }

        return $query->groupBy('movementType')
            ->select('movementType', DB::raw('COUNT(*) as _count'), DB::raw('SUM(ABS(quantity)) as quantitySum'))
            ->get()
            ->map(fn ($row) => [
                'movementType' => $row->movementType,
                '_count' => (int) $row->_count,
                '_sum' => ['quantity' => (int) $row->quantitySum],
            ]);
    }

    public function lowStock()
    {
        return ProductVariant::with(['product:id,name,sku', 'color:id,name,hexCode', 'size:id,name,abbreviation'])
            ->where('isActive', true)
            ->whereColumn('stock', '<=', 'minStock')
            ->orderBy('stock')
            ->get();
    }

    public function stats(): array
    {
        $active = fn () => ProductVariant::where('isActive', true);

        return [
            'totalVariants' => $active()->count(),
            'lowStock' => $active()->where('minStock', '>', 0)->where('stock', '>', 0)->whereColumn('stock', '<=', 'minStock')->count(),
            'outOfStock' => $active()->where('stock', 0)->count(),
            'totalStock' => (int) $active()->sum('stock'),
            'todayMovements' => VariantMovement::where('createdAt', '>=', now()->startOfDay())->count(),
        ];
    }
}
