<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Input;
use App\Models\InputBatch;
use App\Models\InputBatchMovement;
use App\Models\InputVariant;
use App\Models\InputVariantMovement;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\PurchaseReturn;
use App\Models\PurchaseReturnItem;
use App\Models\VariantMovement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Devoluciones de compra. Cada devolución nace de una orden de compra
 * recibida y revierte (total o parcialmente) el stock que entró por ella.
 * El procesamiento es directo: al crearla se aplica el reverso de stock
 * y se registran los movimientos de inventario.
 */
class PurchaseReturnController extends Controller
{
    use ApiResponse;

    private const RELATIONS = [
        'supplier:id,name,code',
        'purchaseOrder:id,orderNumber,status',
        'items',
    ];

    /** GET /api/purchase-returns */
    public function index(Request $request)
    {
        $query = PurchaseReturn::with(self::RELATIONS);

        if ($request->filled('purchaseOrderId')) {
            $query->where('purchaseOrderId', (int) $request->query('purchaseOrderId'));
        }
        if ($request->filled('supplierId')) {
            $query->where('supplierId', (int) $request->query('supplierId'));
        }

        return $this->success($query->orderByDesc('createdAt')->get());
    }

    /** GET /api/purchase-returns/stats */
    public function stats()
    {
        return $this->success([
            'total' => PurchaseReturn::count(),
            'totalValue' => (float) PurchaseReturn::sum('total'),
            'lastReturn' => PurchaseReturn::orderByDesc('createdAt')->value('createdAt'),
        ]);
    }

    /** GET /api/purchase-returns/generate-number */
    public function generateNumber()
    {
        return $this->success(['returnNumber' => $this->nextNumber()]);
    }

    /** GET /api/purchase-returns/returnable/{purchaseOrderId} — ítems devolubles de una OC. */
    public function returnableItems(int $purchaseOrderId)
    {
        $order = PurchaseOrder::with([
            'supplier:id,name,code',
            'items.variant.product:id,name', 'items.variant.color:id,name', 'items.variant.size:id,name,abbreviation',
            'items.input:id,name,code,unitOfMeasure',
            'items.inputVariant.input:id,name,code', 'items.inputVariant.color:id,name', 'items.inputVariant.size:id,name,abbreviation',
        ])->find($purchaseOrderId);

        if (! $order) {
            return $this->error('Orden de compra no encontrada', 404);
        }
        if (! in_array($order->status, ['RECEIVED', 'PARTIAL'], true)) {
            return $this->error('Solo se puede devolver mercancía de órdenes recibidas', 400);
        }

        // Cantidad ya devuelta por cada ítem de la orden.
        $returned = PurchaseReturnItem::whereIn('purchaseOrderItemId', $order->items->pluck('id'))
            ->select('purchaseOrderItemId')->selectRaw('SUM(quantity) as total')
            ->groupBy('purchaseOrderItemId')->pluck('total', 'purchaseOrderItemId');

        $items = $order->items->map(function ($item) use ($returned) {
            $received = (float) $item->quantityReceived;
            $already = (float) ($returned[$item->id] ?? 0);
            $matrix = $this->itemMatrixInfo($item);

            return [
                'purchaseOrderItemId' => $item->id,
                'variantId' => $item->variantId,
                'inputId' => $item->inputId,
                'inputVariantId' => $item->inputVariantId,
                'description' => $this->describeItem($item),
                'groupName' => $matrix['groupName'],
                'colorName' => $matrix['colorName'],
                'sizeName' => $matrix['sizeName'],
                'unitCost' => (float) $item->unitCost,
                'quantityReceived' => $received,
                'quantityReturned' => $already,
                'returnable' => max(0, $received - $already),
            ];
        })->filter(fn ($i) => $i['returnable'] > 0)->values();

        return $this->success([
            'purchaseOrder' => [
                'id' => $order->id,
                'orderNumber' => $order->orderNumber,
                'status' => $order->status,
                'supplier' => $order->supplier,
            ],
            'items' => $items,
        ]);
    }

    /** POST /api/purchase-returns */
    public function store(Request $request)
    {
        $data = $request->validate([
            'purchaseOrderId' => 'required|integer',
            'reason' => 'required|string',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.purchaseOrderItemId' => 'required|integer',
            'items.*.quantity' => 'required|numeric|min:0.01',
        ]);

        $order = PurchaseOrder::with('items')->find($data['purchaseOrderId']);
        if (! $order) {
            return $this->error('Orden de compra no encontrada', 404);
        }
        if (! in_array($order->status, ['RECEIVED', 'PARTIAL'], true)) {
            return $this->error('Solo se puede devolver mercancía de órdenes recibidas', 400);
        }

        // Validar cantidades contra lo recibido y lo ya devuelto.
        $returned = PurchaseReturnItem::whereIn('purchaseOrderItemId', $order->items->pluck('id'))
            ->select('purchaseOrderItemId')->selectRaw('SUM(quantity) as total')
            ->groupBy('purchaseOrderItemId')->pluck('total', 'purchaseOrderItemId');

        $resolved = [];
        foreach ($data['items'] as $row) {
            $poItem = $order->items->firstWhere('id', $row['purchaseOrderItemId']);
            if (! $poItem) {
                return $this->error("El ítem {$row['purchaseOrderItemId']} no pertenece a la orden", 400);
            }
            $available = (float) $poItem->quantityReceived - (float) ($returned[$poItem->id] ?? 0);
            if ($row['quantity'] > $available + 0.0001) {
                return $this->error("No se puede devolver más de {$available} del ítem ".$this->describeItem($poItem), 400);
            }
            $resolved[] = ['poItem' => $poItem, 'qty' => (float) $row['quantity']];
        }

        $user = $request->user();

        $return = DB::transaction(function () use ($order, $data, $resolved, $user) {
            $return = PurchaseReturn::create([
                'returnNumber' => $this->nextNumber(),
                'purchaseOrderId' => $order->id,
                'supplierId' => $order->supplierId,
                'reason' => $data['reason'],
                'notes' => $data['notes'] ?? null,
                'total' => 0,
                'createdById' => $user->id,
                'createdByName' => $user->name,
            ]);

            $total = 0;
            foreach ($resolved as $r) {
                $poItem = $r['poItem'];
                $qty = $r['qty'];
                $subtotal = $qty * (float) $poItem->unitCost;
                $total += $subtotal;

                PurchaseReturnItem::create([
                    'purchaseReturnId' => $return->id,
                    'purchaseOrderItemId' => $poItem->id,
                    'variantId' => $poItem->variantId,
                    'inputId' => $poItem->inputId,
                    'inputVariantId' => $poItem->inputVariantId,
                    'description' => $this->describeItem($poItem),
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

        return $this->created($return->load(self::RELATIONS), 'Devolución registrada y stock revertido');
    }

    /** GET /api/purchase-returns/{id} */
    public function show(int $id)
    {
        $return = PurchaseReturn::with(self::RELATIONS)->find($id);
        if (! $return) {
            return $this->error('Devolución no encontrada', 404);
        }

        return $this->success($return);
    }

    /** Genera el siguiente número de devolución (DEV-AAAA-NNNN). */
    private function nextNumber(): string
    {
        $year = date('Y');
        $count = PurchaseReturn::where('returnNumber', 'like', "DEV-{$year}%")->count();

        return sprintf('DEV-%s-%04d', $year, $count + 1);
    }

    /** Descripción legible de un ítem de orden de compra. */
    private function describeItem(PurchaseOrderItem $item): string
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

    /**
     * Datos para la vista matriz: grupo (insumo/producto) y color/talla.
     * Requiere que las relaciones estén precargadas (ver returnableItems).
     */
    private function itemMatrixInfo(PurchaseOrderItem $item): array
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

    /** Revierte el stock de un ítem devuelto y registra el movimiento. */
    private function revertStock(PurchaseOrderItem $poItem, float $qty, PurchaseReturn $return, int $userId): void
    {
        $ref = "Devolución {$return->returnNumber}";

        if ($poItem->variantId) {
            $variant = ProductVariant::find($poItem->variantId);
            if (! $variant) {
                return;
            }
            $previous = (int) $variant->stock;
            $variant->stock = max(0, $previous - $qty);
            $variant->save();

            VariantMovement::create([
                'variantId' => $variant->id,
                'movementType' => 'ADJUSTMENT',
                'quantity' => -$qty,
                'previousStock' => $previous,
                'newStock' => $variant->stock,
                'referenceType' => 'purchase_return',
                'referenceId' => $return->id,
                'reason' => $ref,
                'userId' => $userId,
                'unitCost' => $poItem->unitCost,
            ]);

            return;
        }

        if ($poItem->inputVariantId) {
            $iv = InputVariant::find($poItem->inputVariantId);
            if (! $iv) {
                return;
            }
            $previous = (float) $iv->currentStock;
            $iv->currentStock = max(0, $previous - $qty);
            $iv->save();

            InputVariantMovement::create([
                'inputVariantId' => $iv->id,
                'movementType' => 'DEVOLUCION',
                'quantity' => -$qty,
                'previousStock' => $previous,
                'newStock' => $iv->currentStock,
                'referenceType' => 'purchase_return',
                'referenceId' => $return->id,
                'reason' => $ref,
                'userId' => $userId,
                'unitCost' => $poItem->unitCost,
            ]);

            $total = InputVariant::where('inputId', $iv->inputId)->where('isActive', true)->sum('currentStock');
            Input::where('id', $iv->inputId)->update(['currentStock' => $total]);

            return;
        }

        if ($poItem->inputId) {
            $input = Input::find($poItem->inputId);
            if (! $input) {
                return;
            }
            $input->currentStock = max(0, (float) $input->currentStock - $qty);
            $input->save();

            $batch = InputBatch::where('inputId', $poItem->inputId)->where('isActive', true)
                ->orderByDesc('createdAt')->first();
            if ($batch) {
                $batch->currentQuantity = max(0, (float) $batch->currentQuantity - $qty);
                $batch->save();

                InputBatchMovement::create([
                    'inputId' => $input->id,
                    'inputBatchId' => $batch->id,
                    'movementType' => 'DEVOLUCION',
                    'quantity' => -$qty,
                    'referenceType' => 'purchase_return',
                    'referenceId' => $return->id,
                    'reason' => $ref,
                    'userId' => $userId,
                ]);
            }
        }
    }
}
