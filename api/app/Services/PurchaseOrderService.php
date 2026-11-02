<?php

namespace App\Services;

use App\Models\Input;
use App\Models\InputBatch;
use App\Models\InputBatchMovement;
use App\Models\InputVariant;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Reglas de las órdenes de compra: numeración (OC-AAAA-NNNN), creación y recepción de
 * mercancía. Los errores salen como RuntimeException (código 404 = no existe; el resto 400).
 */
class PurchaseOrderService
{
    public function __construct(
        private NumberSequenceService $numbers,
        private StockService $stock,
    ) {}

    /** Próximo número sin consumirlo (GET generate-number). */
    public function peekNumber(): string
    {
        return $this->numbers->peek(NumberSequenceService::PURCHASE_ORDER);
    }

    /** Crea la orden en borrador con sus ítems. */
    public function create(array $data, int $userId): PurchaseOrder
    {
        $subtotal = 0;
        foreach ($data['items'] as $item) {
            $subtotal += $item['quantity'] * $item['unitCost'];
        }

        return DB::transaction(function () use ($data, $subtotal, $userId) {
            $order = PurchaseOrder::create([
                'orderNumber' => $this->numbers->next(NumberSequenceService::PURCHASE_ORDER),
                'supplierId' => $data['supplierId'],
                'status' => 'DRAFT',
                'subtotal' => $subtotal,
                'total' => $subtotal,
                'expectedDate' => $data['expectedDate'] ?? null,
                'notes' => $data['notes'] ?? null,
                'createdById' => $userId,
            ]);
            foreach ($data['items'] as $item) {
                PurchaseOrderItem::create([
                    'purchaseOrderId' => $order->id,
                    'variantId' => $item['variantId'] ?? null,
                    'inputId' => $item['inputId'] ?? null,
                    'inputVariantId' => $item['inputVariantId'] ?? null,
                    'description' => $item['description'] ?? null,
                    'quantity' => $item['quantity'],
                    'unitCost' => $item['unitCost'],
                    'subtotal' => $item['quantity'] * $item['unitCost'],
                    'notes' => $item['notes'] ?? null,
                ]);
            }

            return $order;
        });
    }

    /**
     * Recibe mercancía: suma lo recibido a cada ítem, ingresa el stock (variante de producto,
     * insumo con lote o variante de insumo) y recalcula el estado (PARTIAL / RECEIVED).
     *
     * La orden y sus ítems se bloquean (FOR UPDATE) antes de validar: dos recepciones
     * simultáneas (doble clic, dos pestañas) ya no leen el mismo "recibido" y no pueden
     * ingresar más de lo pendiente entre las dos. Ítems que no son de la orden se ignoran.
     *
     * @param  array<int, array{itemId: int, quantityReceived: int|float}>  $rows
     */
    public function receive(int $orderId, array $rows, int $userId): PurchaseOrder
    {
        return DB::transaction(function () use ($orderId, $rows, $userId) {
            $order = PurchaseOrder::whereKey($orderId)->lockForUpdate()->first();
            if (! $order) {
                throw new RuntimeException('Orden de compra no encontrada', 404);
            }
            if (! in_array($order->status, ['CONFIRMED', 'PARTIAL'], true)) {
                throw new RuntimeException('La orden debe estar confirmada para recibir mercancía');
            }

            $items = PurchaseOrderItem::where('purchaseOrderId', $order->id)
                ->orderBy('id')->lockForUpdate()->get()->keyBy('id');

            // Validar contra lo pendiente, acumulando filas repetidas del mismo ítem.
            $receiving = [];
            foreach ($rows as $r) {
                $item = $items->get($r['itemId']);
                if (! $item) {
                    continue;
                }
                $receiving[$item->id] = ($receiving[$item->id] ?? 0) + $r['quantityReceived'];
                if ((float) $item->quantityReceived + $receiving[$item->id] > (float) $item->quantity) {
                    throw new RuntimeException("No se puede recibir más de {$item->quantity} unidades para el item {$item->id}");
                }
            }

            foreach ($rows as $r) {
                $item = $items->get($r['itemId']);
                if (! $item) {
                    continue;
                }
                $qty = $r['quantityReceived'];
                $item->quantityReceived = (float) $item->quantityReceived + $qty;
                $item->save();

                if ($item->variantId) {
                    $this->receiveVariant($item, $qty, $order, $userId);
                }
                if ($item->inputId) {
                    $this->receiveInput($item, $qty, $order, $userId);
                }
                if ($item->inputVariantId) {
                    $this->receiveInputVariant($item, $qty, $order, $userId);
                }
            }

            // Recalcular estado de la orden.
            $allReceived = $items->every(fn ($i) => (float) $i->quantityReceived >= (float) $i->quantity);
            $someReceived = $items->contains(fn ($i) => (float) $i->quantityReceived > 0);

            $newStatus = $allReceived ? 'RECEIVED' : ($someReceived ? 'PARTIAL' : $order->status);
            if ($newStatus !== $order->status) {
                $order->status = $newStatus;
                if ($newStatus === 'RECEIVED') {
                    $order->receivedDate = now();
                }
                $order->save();
            }

            return $order;
        });
    }

    private function receiveVariant(PurchaseOrderItem $item, int|float $qty, PurchaseOrder $order, int $userId): void
    {
        if (! ProductVariant::whereKey($item->variantId)->exists()) {
            return;
        }

        $this->stock->variantIn($item->variantId, $qty, 'PURCHASE', [
            'referenceType' => 'purchase_order',
            'referenceId' => $order->id,
            'reason' => "Recepción de OC {$order->orderNumber}",
            'userId' => $userId,
            'unitCost' => $item->unitCost,
        ]);
    }

    /** Insumo simple: suma al stock del insumo y al último lote activo (o crea uno). */
    private function receiveInput(PurchaseOrderItem $item, int|float $qty, PurchaseOrder $order, int $userId): void
    {
        $input = Input::whereKey($item->inputId)->lockForUpdate()->first();
        if (! $input) {
            return;
        }
        $input->currentStock = (float) $input->currentStock + $qty;
        $input->save();

        $batch = InputBatch::where('inputId', $item->inputId)->where('isActive', true)
            ->orderByDesc('createdAt')->lockForUpdate()->first();
        if (! $batch) {
            $batch = InputBatch::create([
                'inputId' => $item->inputId,
                'batchNumber' => "OC-{$order->orderNumber}-{$item->id}",
                'initialQuantity' => $qty,
                'currentQuantity' => $qty,
                'unitCost' => $item->unitCost,
                'totalCost' => (float) $item->unitCost * $qty,
                'purchaseDate' => now(),
                'isActive' => true,
            ]);
        } else {
            $batch->currentQuantity = (float) $batch->currentQuantity + $qty;
            $batch->save();
        }

        InputBatchMovement::create([
            'inputId' => $item->inputId,
            'inputBatchId' => $batch->id,
            'movementType' => 'ENTRADA',
            'quantity' => $qty,
            'reason' => "Recepción de OC {$order->orderNumber}",
            'referenceType' => 'purchase_order',
            'referenceId' => $order->id,
            'userId' => $userId,
        ]);
    }

    private function receiveInputVariant(PurchaseOrderItem $item, int|float $qty, PurchaseOrder $order, int $userId): void
    {
        $iv = InputVariant::find($item->inputVariantId);
        if (! $iv) {
            return;
        }

        $this->stock->inputVariantIn($iv->id, (float) $qty, 'ENTRADA', [
            'referenceType' => 'purchase_order',
            'referenceId' => $order->id,
            'reason' => "Recepción de OC {$order->orderNumber}",
            'userId' => $userId,
            'unitCost' => $item->unitCost,
        ]);

        $total = InputVariant::where('inputId', $iv->inputId)->where('isActive', true)->sum('currentStock');
        Input::where('id', $iv->inputId)->update(['currentStock' => $total]);
    }
}
