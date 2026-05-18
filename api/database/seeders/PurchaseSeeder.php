<?php

namespace Database\Seeders;

use App\Models\Input;
use App\Models\InputBatch;
use App\Models\InputBatchMovement;
use App\Models\InputVariant;
use App\Models\InputVariantMovement;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Órdenes de compra de arranque. El stock de materia prima entra por aquí:
 * los insumos nacen en cero (InventorySeeder) y se surten recibiendo estas
 * órdenes, que generan los movimientos de inventario correspondientes.
 *
 * Los PRODUCTOS quedan en stock cero: no se compran terminados, se producen
 * bajo pedido a partir de los insumos.
 *
 *  - OC-2026-0001  Prendas base + consumibles → RECIBIDA
 *  - OC-2026-0002  Reposición de consumibles  → CONFIRMADA (pendiente)
 */
class PurchaseSeeder extends Seeder
{
    private int $itemSeq = 0;

    public function run(): void
    {
        $supplier = Supplier::where('code', 'PROV-0001')->first();
        $adminId = User::where('email', 'admin@marketplace.com')->value('id');
        if (! $supplier) {
            return;
        }

        // ---- OC-0001: prendas base (variantes de insumo) + consumibles → recibida ----
        $items = [];
        foreach (InputVariant::all() as $iv) {
            $items[] = ['inputVariantId' => $iv->id, 'qty' => 60, 'unitCost' => (float) $iv->unitCost,
                'description' => 'Prenda base '.$iv->sku];
        }
        $consumibleQty = [
            'INS-0005' => 500, 'INS-0006' => 800, 'INS-0007' => 120,
            'INS-0008' => 4000, 'INS-0009' => 40, 'INS-0010' => 1500,
        ];
        foreach (Input::whereIn('code', array_keys($consumibleQty))->get() as $input) {
            $items[] = ['inputId' => $input->id, 'qty' => $consumibleQty[$input->code],
                'unitCost' => (float) $input->unitCost, 'description' => $input->name];
        }
        $this->createOrder('OC-2026-0001', $supplier->id, $adminId,
            'Compra inicial de prendas base y materiales de personalización.', $items, received: true);

        // ---- OC-0002: reposición de consumibles → confirmada (pendiente de recibir) ----
        $items = [];
        foreach (Input::whereIn('code', ['INS-0005', 'INS-0006'])->get() as $input) {
            $items[] = ['inputId' => $input->id, 'qty' => 300,
                'unitCost' => (float) $input->unitCost, 'description' => $input->name];
        }
        $this->createOrder('OC-2026-0002', $supplier->id, $adminId,
            'Reposición de cinta y papel transfer (pendiente de recibir).', $items, received: false);
    }

    /** Crea una orden de compra con sus ítems; si $received, la recibe. */
    private function createOrder(string $number, int $supplierId, ?int $adminId, string $notes, array $items, bool $received): void
    {
        $subtotal = array_sum(array_map(fn ($i) => $i['qty'] * $i['unitCost'], $items));

        $order = PurchaseOrder::updateOrCreate(
            ['orderNumber' => $number],
            [
                'supplierId' => $supplierId,
                'status' => $received ? 'RECEIVED' : 'CONFIRMED',
                'subtotal' => $subtotal,
                'tax' => 0,
                'discount' => 0,
                'total' => $subtotal,
                'orderDate' => now(),
                'expectedDate' => now()->addDays(5),
                'receivedDate' => $received ? now() : null,
                'notes' => $notes,
                'createdById' => $adminId,
            ]
        );

        foreach ($items as $i) {
            $qty = $i['qty'];
            $item = PurchaseOrderItem::create([
                'purchaseOrderId' => $order->id,
                'variantId' => $i['variantId'] ?? null,
                'inputId' => $i['inputId'] ?? null,
                'inputVariantId' => $i['inputVariantId'] ?? null,
                'description' => $i['description'] ?? null,
                'quantity' => $qty,
                'quantityReceived' => $received ? $qty : 0,
                'unitCost' => $i['unitCost'],
                'subtotal' => $qty * $i['unitCost'],
            ]);

            if ($received) {
                $this->receiveItem($item, $qty, $order, $adminId);
            }
        }
    }

    /** Aplica la recepción de un ítem de insumo: suma stock y registra el movimiento. */
    private function receiveItem(PurchaseOrderItem $item, float $qty, PurchaseOrder $order, ?int $userId): void
    {
        if ($item->inputVariantId) {
            $iv = InputVariant::find($item->inputVariantId);
            $previous = (float) $iv->currentStock;
            $iv->currentStock = $previous + $qty;
            $iv->save();

            InputVariantMovement::create([
                'inputVariantId' => $iv->id,
                'movementType' => 'ENTRADA',
                'quantity' => $qty,
                'previousStock' => $previous,
                'newStock' => $iv->currentStock,
                'referenceType' => 'purchase_order',
                'referenceId' => $order->id,
                'reason' => "Recepción de {$order->orderNumber}",
                'userId' => $userId,
                'unitCost' => $item->unitCost,
            ]);

            // El stock del insumo es la suma de sus variantes.
            $total = InputVariant::where('inputId', $iv->inputId)->sum('currentStock');
            Input::where('id', $iv->inputId)->update(['currentStock' => $total]);

            return;
        }

        if ($item->inputId) {
            $input = Input::find($item->inputId);
            $input->currentStock = (float) $input->currentStock + $qty;
            $input->save();

            $this->itemSeq++;
            $batch = InputBatch::create([
                'inputId' => $input->id,
                'batchNumber' => "{$order->orderNumber}-{$this->itemSeq}",
                'supplier' => $order->supplier?->name,
                'initialQuantity' => $qty,
                'currentQuantity' => $qty,
                'reservedQuantity' => 0,
                'unitCost' => $item->unitCost,
                'totalCost' => (float) $item->unitCost * $qty,
                'purchaseDate' => now(),
                'notes' => "Lote recibido de OC {$order->orderNumber}.",
                'isActive' => true,
            ]);

            InputBatchMovement::create([
                'inputId' => $input->id,
                'inputBatchId' => $batch->id,
                'movementType' => 'ENTRADA',
                'quantity' => $qty,
                'referenceType' => 'purchase_order',
                'referenceId' => $order->id,
                'reason' => "Recepción de {$order->orderNumber}",
                'userId' => $userId,
            ]);
        }
    }
}
