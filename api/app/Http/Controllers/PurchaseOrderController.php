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
use App\Models\VariantMovement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseOrderController extends Controller
{
    use ApiResponse;

    private const VALID_TRANSITIONS = [
        'DRAFT' => ['SENT', 'CANCELLED'],
        'SENT' => ['CONFIRMED', 'CANCELLED'],
        'CONFIRMED' => ['PARTIAL', 'RECEIVED', 'CANCELLED'],
        'PARTIAL' => ['RECEIVED', 'CANCELLED'],
        'RECEIVED' => [],
        'CANCELLED' => [],
    ];

    private const LIST_RELATIONS = [
        'supplier:id,code,name',
        'items.variant:id,sku,productId',
        'items.variant.product:id,name',
        'items.input:id,code,name',
    ];

    private const DETAIL_RELATIONS = [
        'supplier',
        'items.variant.product:id,name,sku',
        'items.variant.color:id,name,hexCode',
        'items.variant.size:id,name,abbreviation',
        'items.input.inputType:id,name',
        'items.inputVariant.input:id,name,code',
        'items.inputVariant.color:id,name,hexCode',
        'items.inputVariant.size:id,name,abbreviation',
    ];

    private function generateNumberValue(): string
    {
        $prefix = 'OC-'.now()->year.'-';
        $last = PurchaseOrder::where('orderNumber', 'like', "{$prefix}%")
            ->orderByDesc('orderNumber')->first();
        $next = $last ? ((int) str_replace($prefix, '', $last->orderNumber)) + 1 : 1;

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    public function index(Request $request)
    {
        $query = PurchaseOrder::with(self::LIST_RELATIONS);

        if ($request->filled('search')) {
            $s = $request->query('search');
            $query->where(function ($q) use ($s) {
                $q->where('orderNumber', 'like', "%{$s}%")
                    ->orWhere('supplierInvoice', 'like', "%{$s}%")
                    ->orWhereHas('supplier', fn ($sup) => $sup->where('name', 'like', "%{$s}%"));
            });
        }
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->filled('supplierId')) {
            $query->where('supplierId', $request->query('supplierId'));
        }
        if ($request->filled('fromDate')) {
            $query->where('orderDate', '>=', $request->query('fromDate'));
        }
        if ($request->filled('toDate')) {
            $query->where('orderDate', '<=', $request->query('toDate'));
        }

        return $this->success($query->orderByDesc('createdAt')->get());
    }

    public function stats()
    {
        $byStatus = PurchaseOrder::selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status');
        $monthly = PurchaseOrder::where('status', 'RECEIVED')
            ->where('receivedDate', '>=', now()->startOfMonth())->sum('total');

        $counts = fn ($s) => (int) ($byStatus[$s] ?? 0);

        return $this->success([
            'total' => PurchaseOrder::count(),
            'byStatus' => [
                'draft' => $counts('DRAFT'), 'sent' => $counts('SENT'),
                'confirmed' => $counts('CONFIRMED'), 'partial' => $counts('PARTIAL'),
                'received' => $counts('RECEIVED'), 'cancelled' => $counts('CANCELLED'),
            ],
            'pendingCount' => $counts('DRAFT') + $counts('SENT') + $counts('CONFIRMED') + $counts('PARTIAL'),
            'monthlyTotal' => (float) $monthly,
        ]);
    }

    public function generateNumber()
    {
        return $this->success(['orderNumber' => $this->generateNumberValue()]);
    }

    public function show(int $id)
    {
        $order = PurchaseOrder::with(self::DETAIL_RELATIONS)->find($id);

        return $order ? $this->success($order) : $this->error('Orden de compra no encontrada', 404);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'supplierId' => 'required|integer',
            'expectedDate' => 'nullable|date',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.variantId' => 'nullable|integer',
            'items.*.inputId' => 'nullable|integer',
            'items.*.inputVariantId' => 'nullable|integer',
            'items.*.description' => 'nullable|string',
            'items.*.quantity' => 'required|numeric|min:0',
            'items.*.unitCost' => 'required|numeric|min:0',
            'items.*.notes' => 'nullable|string',
        ]);

        $subtotal = 0;
        foreach ($data['items'] as $item) {
            $subtotal += $item['quantity'] * $item['unitCost'];
        }

        $order = DB::transaction(function () use ($data, $subtotal, $request) {
            $order = PurchaseOrder::create([
                'orderNumber' => $this->generateNumberValue(),
                'supplierId' => $data['supplierId'],
                'status' => 'DRAFT',
                'subtotal' => $subtotal,
                'total' => $subtotal,
                'expectedDate' => $data['expectedDate'] ?? null,
                'notes' => $data['notes'] ?? null,
                'createdById' => $request->user()->id,
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

        return $this->created(PurchaseOrder::with(self::DETAIL_RELATIONS)->find($order->id), 'Orden de compra creada');
    }

    public function update(Request $request, int $id)
    {
        $order = PurchaseOrder::find($id);
        if (! $order) {
            return $this->error('Orden de compra no encontrada', 404);
        }
        if ($order->status !== 'DRAFT') {
            return $this->error('Solo se pueden editar órdenes en estado borrador', 400);
        }

        $data = $request->validate([
            'supplierId' => 'nullable|integer',
            'expectedDate' => 'nullable|date',
            'notes' => 'nullable|string',
            'supplierInvoice' => 'nullable|string',
            'items' => 'nullable|array',
            'items.*.variantId' => 'nullable|integer',
            'items.*.inputId' => 'nullable|integer',
            'items.*.inputVariantId' => 'nullable|integer',
            'items.*.description' => 'nullable|string',
            'items.*.quantity' => 'required_with:items|numeric|min:0',
            'items.*.unitCost' => 'required_with:items|numeric|min:0',
            'items.*.notes' => 'nullable|string',
        ]);

        DB::transaction(function () use ($order, $data) {
            $subtotal = (float) $order->subtotal;
            if (array_key_exists('items', $data) && is_array($data['items'])) {
                PurchaseOrderItem::where('purchaseOrderId', $order->id)->delete();
                $subtotal = 0;
                foreach ($data['items'] as $item) {
                    $sub = $item['quantity'] * $item['unitCost'];
                    $subtotal += $sub;
                    PurchaseOrderItem::create([
                        'purchaseOrderId' => $order->id,
                        'variantId' => $item['variantId'] ?? null,
                        'inputId' => $item['inputId'] ?? null,
                        'inputVariantId' => $item['inputVariantId'] ?? null,
                        'description' => $item['description'] ?? null,
                        'quantity' => $item['quantity'],
                        'unitCost' => $item['unitCost'],
                        'subtotal' => $sub,
                        'notes' => $item['notes'] ?? null,
                    ]);
                }
            }
            foreach (['supplierId', 'expectedDate', 'notes', 'supplierInvoice'] as $f) {
                if (array_key_exists($f, $data) && $data[$f] !== null) {
                    $order->{$f} = $data[$f];
                }
            }
            $order->subtotal = $subtotal;
            $order->total = $subtotal;
            $order->save();
        });

        return $this->success(PurchaseOrder::with(self::DETAIL_RELATIONS)->find($id), 'Orden actualizada');
    }

    public function updateStatus(Request $request, int $id)
    {
        $data = $request->validate([
            'status' => 'required|in:DRAFT,SENT,CONFIRMED,PARTIAL,RECEIVED,CANCELLED',
        ]);
        $order = PurchaseOrder::find($id);
        if (! $order) {
            return $this->error('Orden de compra no encontrada', 404);
        }
        if (! in_array($data['status'], self::VALID_TRANSITIONS[$order->status] ?? [], true)) {
            return $this->error("No se puede cambiar de {$order->status} a {$data['status']}", 400);
        }

        $order->status = $data['status'];
        if ($data['status'] === 'RECEIVED') {
            $order->receivedDate = now();
        }
        $order->save();

        return $this->success(PurchaseOrder::with(self::DETAIL_RELATIONS)->find($id), 'Estado actualizado');
    }

    public function receive(Request $request, int $id)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.itemId' => 'required|integer',
            'items.*.quantityReceived' => 'required|numeric|min:0',
        ]);

        $order = PurchaseOrder::with('items')->find($id);
        if (! $order) {
            return $this->error('Orden de compra no encontrada', 404);
        }
        if (! in_array($order->status, ['CONFIRMED', 'PARTIAL'], true)) {
            return $this->error('La orden debe estar confirmada para recibir mercancía', 400);
        }

        $userId = $request->user()->id;

        try {
            DB::transaction(function () use ($order, $data, $userId) {
                foreach ($data['items'] as $r) {
                    $item = $order->items->firstWhere('id', $r['itemId']);
                    if (! $item) {
                        continue;
                    }
                    $qty = $r['quantityReceived'];
                    $newReceived = (float) $item->quantityReceived + $qty;
                    if ($newReceived > (float) $item->quantity) {
                        throw new \RuntimeException("No se puede recibir más de {$item->quantity} unidades para el item {$item->id}");
                    }
                    $item->quantityReceived = $newReceived;
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
                $items = PurchaseOrderItem::where('purchaseOrderId', $order->id)->get();
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
            });
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return $this->success(PurchaseOrder::with(self::DETAIL_RELATIONS)->find($id), 'Items recibidos');
    }

    public function destroy(Request $request, int $id)
    {
        $order = PurchaseOrder::find($id);
        if (! $order) {
            return $this->error('Orden de compra no encontrada', 404);
        }

        // ?force=1 (solo admin): permite eliminar órdenes en cualquier estado,
        // limpiando en cascada sus ítems y los movimientos de inventario que
        // generó su recepción. Sin force se mantiene la regla normal.
        $force = $request->boolean('force');

        if (! $force && ! in_array($order->status, ['DRAFT', 'CANCELLED'], true)) {
            return $this->error('Solo se pueden eliminar órdenes en borrador o canceladas', 400);
        }

        DB::transaction(function () use ($order) {
            VariantMovement::where('referenceType', 'purchase_order')->where('referenceId', $order->id)->delete();
            InputBatchMovement::where('referenceType', 'purchase_order')->where('referenceId', $order->id)->delete();
            InputVariantMovement::where('referenceType', 'purchase_order')->where('referenceId', $order->id)->delete();
            PurchaseOrderItem::where('purchaseOrderId', $order->id)->delete();
            $order->delete();
        });

        return $this->success(null, 'Orden eliminada correctamente');
    }

    private function receiveVariant(PurchaseOrderItem $item, float $qty, PurchaseOrder $order, int $userId): void
    {
        $variant = ProductVariant::find($item->variantId);
        if (! $variant) {
            return;
        }
        $previous = $variant->stock;
        $variant->stock = $previous + $qty;
        $variant->save();

        VariantMovement::create([
            'variantId' => $variant->id,
            'movementType' => 'PURCHASE',
            'quantity' => $qty,
            'previousStock' => $previous,
            'newStock' => $variant->stock,
            'referenceType' => 'purchase_order',
            'referenceId' => $order->id,
            'reason' => "Recepción de OC {$order->orderNumber}",
            'userId' => $userId,
            'unitCost' => $item->unitCost,
        ]);
    }

    private function receiveInput(PurchaseOrderItem $item, float $qty, PurchaseOrder $order, int $userId): void
    {
        $input = Input::find($item->inputId);
        if (! $input) {
            return;
        }
        $input->currentStock = (float) $input->currentStock + $qty;
        $input->save();

        $batch = InputBatch::where('inputId', $item->inputId)->where('isActive', true)
            ->orderByDesc('createdAt')->first();
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

    private function receiveInputVariant(PurchaseOrderItem $item, float $qty, PurchaseOrder $order, int $userId): void
    {
        $iv = InputVariant::find($item->inputVariantId);
        if (! $iv) {
            return;
        }
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
            'reason' => "Recepción de OC {$order->orderNumber}",
            'userId' => $userId,
            'unitCost' => $item->unitCost,
        ]);

        $total = InputVariant::where('inputId', $iv->inputId)->where('isActive', true)->sum('currentStock');
        Input::where('id', $iv->inputId)->update(['currentStock' => $total]);
    }
}
