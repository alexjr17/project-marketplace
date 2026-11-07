<?php

namespace App\Services\Purchasing;

use App\Exceptions\BusinessRuleException;
use App\Exceptions\InsufficientStockException;
use App\Models\Input;
use App\Models\InputBatch;
use App\Models\InputBatchMovement;
use App\Models\InputVariant;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\PurchaseReturn;
use App\Models\PurchaseReturnItem;
use App\Models\User;
use App\Services\NumberSequenceService;
use App\Services\StockService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Devoluciones de compra. Cada devolución nace de una orden de compra recibida y revierte
 * (total o parcialmente) el stock que entró por ella: se valida contra lo recibido menos lo
 * ya devuelto y contra el stock que queda (no se devuelve mercancía ya consumida).
 */
class PurchaseReturnService
{
    public const RELATIONS = [
        'supplier:id,name,code',
        'purchaseOrder:id,orderNumber,status',
        'items',
    ];

    private const RETURNABLE_STATUSES = ['RECEIVED', 'PARTIAL'];

    public function __construct(
        private NumberSequenceService $numbers,
        private StockService $stock,
    ) {}

    public function list(array $filters): Collection
    {
        $query = PurchaseReturn::with(self::RELATIONS);
        if (! empty($filters['purchaseOrderId'])) {
            $query->where('purchaseOrderId', (int) $filters['purchaseOrderId']);
        }
        if (! empty($filters['supplierId'])) {
            $query->where('supplierId', (int) $filters['supplierId']);
        }

        return $query->orderByDesc('createdAt')->get();
    }

    public function stats(): array
    {
        return [
            'total' => PurchaseReturn::count(),
            'totalValue' => (float) PurchaseReturn::sum('total'),
            'lastReturn' => PurchaseReturn::orderByDesc('createdAt')->value('createdAt'),
        ];
    }

    public function peekNumber(): string
    {
        return $this->numbers->peek(NumberSequenceService::PURCHASE_RETURN);
    }

    public function find(int $id): PurchaseReturn
    {
        return PurchaseReturn::with(self::RELATIONS)->find($id)
            ?? throw new BusinessRuleException('Devolución no encontrada', 404);
    }

    /** Ítems de una orden recibida que todavía se pueden devolver, con sus datos de matriz. */
    public function returnableItems(int $purchaseOrderId): array
    {
        $order = PurchaseOrder::with([
            'supplier:id,name,code',
            'items.variant.product:id,name', 'items.variant.color:id,name', 'items.variant.size:id,name,abbreviation',
            'items.input:id,name,code,unitOfMeasure',
            'items.inputVariant.input:id,name,code', 'items.inputVariant.color:id,name', 'items.inputVariant.size:id,name,abbreviation',
        ])->find($purchaseOrderId);
        $this->assertReturnable($order);

        $returned = $this->returnedByItem($order);

        $items = $order->items->map(function (PurchaseOrderItem $item) use ($returned) {
            $received = (float) $item->quantityReceived;
            $already = (float) ($returned[$item->id] ?? 0);
            $matrix = $this->matrixInfo($item);

            return [
                'purchaseOrderItemId' => $item->id,
                'variantId' => $item->variantId,
                'inputId' => $item->inputId,
                'inputVariantId' => $item->inputVariantId,
                'description' => $this->describe($item),
                'groupName' => $matrix['groupName'],
                'colorName' => $matrix['colorName'],
                'sizeName' => $matrix['sizeName'],
                'unitCost' => (float) $item->unitCost,
                'quantityReceived' => $received,
                'quantityReturned' => $already,
                'returnable' => max(0, $received - $already),
            ];
        })->filter(fn ($i) => $i['returnable'] > 0)->values();

        return [
            'purchaseOrder' => [
                'id' => $order->id,
                'orderNumber' => $order->orderNumber,
                'status' => $order->status,
                'supplier' => $order->supplier,
            ],
            'items' => $items,
        ];
    }

    /**
     * Registra la devolución y revierte el stock en una transacción. Las filas repetidas de un
     * mismo ítem se suman antes de validar contra lo disponible.
     *
     * @param  array{purchaseOrderId:int, reason:string, notes?:?string, items: array<int, array{purchaseOrderItemId:int, quantity:float}>}  $data
     */
    public function create(array $data, User $user): PurchaseReturn
    {
        $order = PurchaseOrder::with('items')->find($data['purchaseOrderId']);
        $this->assertReturnable($order);

        $returned = $this->returnedByItem($order);
        $requested = [];
        foreach ($data['items'] as $row) {
            $poItem = $order->items->firstWhere('id', $row['purchaseOrderItemId']);
            if (! $poItem) {
                throw new BusinessRuleException("El ítem {$row['purchaseOrderItemId']} no pertenece a la orden", 400);
            }
            $requested[$poItem->id] = ($requested[$poItem->id] ?? 0) + (float) $row['quantity'];
            $available = (float) $poItem->quantityReceived - (float) ($returned[$poItem->id] ?? 0);
            if ($requested[$poItem->id] > $available + 0.0001) {
                throw new BusinessRuleException("No se puede devolver más de {$available} del ítem ".$this->describe($poItem), 400);
            }
        }

        return DB::transaction(function () use ($order, $data, $user) {
            $return = PurchaseReturn::create([
                'returnNumber' => $this->numbers->next(NumberSequenceService::PURCHASE_RETURN),
                'purchaseOrderId' => $order->id,
                'supplierId' => $order->supplierId,
                'reason' => $data['reason'],
                'notes' => $data['notes'] ?? null,
                'total' => 0,
                'createdById' => $user->id,
                'createdByName' => $user->name,
            ]);

            $total = 0;
            foreach ($data['items'] as $row) {
                $poItem = $order->items->firstWhere('id', $row['purchaseOrderItemId']);
                $qty = (float) $row['quantity'];
                $subtotal = $qty * (float) $poItem->unitCost;
                $total += $subtotal;

                PurchaseReturnItem::create([
                    'purchaseReturnId' => $return->id,
                    'purchaseOrderItemId' => $poItem->id,
                    'variantId' => $poItem->variantId,
                    'inputId' => $poItem->inputId,
                    'inputVariantId' => $poItem->inputVariantId,
                    'description' => $this->describe($poItem),
                    'quantity' => $qty,
                    'unitCost' => $poItem->unitCost,
                    'subtotal' => $subtotal,
                ]);

                $this->revertStock($poItem, $qty, $return, $user->id);
            }

            $return->total = $total;
            $return->save();

            return $return;
        });
    }

    private function assertReturnable(?PurchaseOrder $order): void
    {
        if (! $order) {
            throw new BusinessRuleException('Orden de compra no encontrada', 404);
        }
        if (! in_array($order->status, self::RETURNABLE_STATUSES, true)) {
            throw new BusinessRuleException('Solo se puede devolver mercancía de órdenes recibidas', 400);
        }
    }

    /** Cantidad ya devuelta por cada ítem de la orden. */
    private function returnedByItem(PurchaseOrder $order): \Illuminate\Support\Collection
    {
        return PurchaseReturnItem::whereIn('purchaseOrderItemId', $order->items->pluck('id'))
            ->select('purchaseOrderItemId')->selectRaw('SUM(quantity) as total')
            ->groupBy('purchaseOrderItemId')->pluck('total', 'purchaseOrderItemId');
    }

    /**
     * Saca del inventario lo devuelto. Si ya no queda stock suficiente (se consumió o vendió),
     * la devolución se rechaza: antes se recortaba a 0 y se cobraba al proveedor lo que no salió.
     */
    private function revertStock(PurchaseOrderItem $poItem, float $qty, PurchaseReturn $return, int $userId): void
    {
        $attrs = [
            'referenceType' => 'purchase_return',
            'referenceId' => $return->id,
            'reason' => "Devolución {$return->returnNumber}",
            'userId' => $userId,
            'unitCost' => $poItem->unitCost,
        ];

        try {
            if ($poItem->variantId) {
                $productId = ProductVariant::whereKey($poItem->variantId)->value('productId');
                if ($productId === null) {
                    return;
                }
                $this->stock->variantOut($poItem->variantId, $qty, 'ADJUSTMENT', $attrs);
                $this->stock->syncProductStock((int) $productId);

                return;
            }

            if ($poItem->inputVariantId) {
                $inputId = InputVariant::whereKey($poItem->inputVariantId)->value('inputId');
                if ($inputId === null) {
                    return;
                }
                $this->stock->inputVariantOut($poItem->inputVariantId, $qty, 'DEVOLUCION', $attrs);
                $total = InputVariant::where('inputId', $inputId)->where('isActive', true)->sum('currentStock');
                Input::whereKey($inputId)->update(['currentStock' => $total]);

                return;
            }
        } catch (InsufficientStockException $e) {
            throw new BusinessRuleException($e->getMessage(), 400);
        }

        if ($poItem->inputId) {
            $this->revertSimpleInput($poItem, $qty, $return, $userId);
        }
    }

    /** Insumo simple (sin variantes): baja el stock del insumo y del último lote activo. */
    private function revertSimpleInput(PurchaseOrderItem $poItem, float $qty, PurchaseReturn $return, int $userId): void
    {
        $input = Input::whereKey($poItem->inputId)->lockForUpdate()->first();
        if (! $input) {
            return;
        }
        if ((float) $input->currentStock + 0.0001 < $qty) {
            throw new BusinessRuleException(
                "Stock insuficiente para {$input->name}. Disponible: ".$this->fmt((float) $input->currentStock).', Solicitado: '.$this->fmt($qty),
                400,
            );
        }
        $input->currentStock = (float) $input->currentStock - $qty;
        $input->save();

        $batch = InputBatch::where('inputId', $poItem->inputId)->where('isActive', true)
            ->orderByDesc('createdAt')->lockForUpdate()->first();
        if (! $batch) {
            return;
        }
        $batch->currentQuantity = max(0, (float) $batch->currentQuantity - $qty);
        $batch->save();

        InputBatchMovement::create([
            'inputId' => $input->id,
            'inputBatchId' => $batch->id,
            'movementType' => 'DEVOLUCION',
            'quantity' => -$qty,
            'referenceType' => 'purchase_return',
            'referenceId' => $return->id,
            'reason' => "Devolución {$return->returnNumber}",
            'userId' => $userId,
        ]);
    }

    /** Descripción legible de un ítem de orden de compra. */
    private function describe(PurchaseOrderItem $item): string
    {
        if ($item->variantId) {
            $v = ProductVariant::with('product')->find($item->variantId);

            return $v ? trim(($v->product->name ?? 'Producto').' '.$v->sku) : ($item->description ?? 'Producto');
        }
        if ($item->inputVariantId) {
            $iv = InputVariant::with('input')->find($item->inputVariantId);

            return $iv ? trim(($iv->input->name ?? 'Insumo').' '.$iv->sku) : ($item->description ?? 'Insumo');
        }
        if ($item->inputId) {
            return Input::where('id', $item->inputId)->value('name') ?? ($item->description ?? 'Insumo');
        }

        return $item->description ?? 'Ítem';
    }

    /** Grupo (insumo/producto) y color/talla para la vista matriz; requiere relaciones precargadas. */
    private function matrixInfo(PurchaseOrderItem $item): array
    {
        if ($item->variantId && $item->variant) {
            return [
                'groupName' => $item->variant->product->name ?? 'Producto',
                'colorName' => $item->variant->color->name ?? null,
                'sizeName' => $item->variant->size->abbreviation ?? $item->variant->size->name ?? null,
            ];
        }
        if ($item->inputVariantId && $item->inputVariant) {
            return [
                'groupName' => $item->inputVariant->input->name ?? 'Insumo',
                'colorName' => $item->inputVariant->color->name ?? null,
                'sizeName' => $item->inputVariant->size->abbreviation ?? $item->inputVariant->size->name ?? null,
            ];
        }
        if ($item->inputId && $item->input) {
            return ['groupName' => $item->input->name ?? 'Insumo', 'colorName' => null, 'sizeName' => null];
        }

        return ['groupName' => $item->description ?? 'Ítem', 'colorName' => null, 'sizeName' => null];
    }

    private function fmt(float $n): string
    {
        return floor($n) == $n ? (string) (int) $n : (string) $n;
    }
}
