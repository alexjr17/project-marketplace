<?php

namespace App\Services\Purchasing;

use App\Exceptions\BusinessRuleException;
use App\Models\Input;
use App\Models\InputBatch;
use App\Models\InputBatchMovement;
use App\Models\InputVariant;
use App\Models\InputVariantMovement;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\VariantMovement;
use App\Services\NumberSequenceService;
use App\Services\StockService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Reglas de las órdenes de compra: numeración (OC-AAAA-NNNN), creación, edición en
 * borrador, cambios de estado, recepción de mercancía y borrado. Las reglas que impiden la
 * operación salen como BusinessRuleException con el código que espera el frontend.
 */
class PurchaseOrderService
{
    /**
     * Cambios de estado manuales. PARTIAL y RECEIVED solo se alcanzan recibiendo mercancía
     * (receive), que es lo que ingresa el stock; PARTIAL → RECEIVED cierra una orden parcial
     * sin esperar el resto.
     */
    private const VALID_TRANSITIONS = [
        'DRAFT' => ['SENT', 'CANCELLED'],
        'SENT' => ['CONFIRMED', 'CANCELLED'],
        'CONFIRMED' => ['CANCELLED'],
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

    public const DETAIL_RELATIONS = [
        'supplier',
        'items.variant.product:id,name,sku',
        'items.variant.color:id,name,hexCode',
        'items.variant.size:id,name,abbreviation',
        'items.input.inputType:id,name',
        'items.inputVariant.input:id,name,code',
        'items.inputVariant.color:id,name,hexCode',
        'items.inputVariant.size:id,name,abbreviation',
    ];

    public function __construct(
        private NumberSequenceService $numbers,
        private StockService $stock,
    ) {}

    /** Próximo número sin consumirlo (GET generate-number). */
    public function peekNumber(): string
    {
        return $this->numbers->peek(NumberSequenceService::PURCHASE_ORDER);
    }

    /** Listado con filtros (búsqueda, estado, proveedor, rango de fechas). */
    public function list(array $filters): Collection
    {
        $query = PurchaseOrder::with(self::LIST_RELATIONS);

        if (! empty($filters['search'])) {
            $s = $filters['search'];
            $query->where(function ($q) use ($s) {
                $q->where('orderNumber', 'like', "%{$s}%")
                    ->orWhere('supplierInvoice', 'like', "%{$s}%")
                    ->orWhereHas('supplier', fn ($sup) => $sup->where('name', 'like', "%{$s}%"));
            });
        }
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['supplierId'])) {
            $query->where('supplierId', $filters['supplierId']);
        }
        if (! empty($filters['fromDate'])) {
            $query->where('orderDate', '>=', $filters['fromDate']);
        }
        if (! empty($filters['toDate'])) {
            $query->where('orderDate', '<=', $filters['toDate']);
        }

        return $query->orderByDesc('createdAt')->get();
    }

    public function stats(): array
    {
        $byStatus = PurchaseOrder::selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status');
        $monthly = PurchaseOrder::where('status', 'RECEIVED')
            ->where('receivedDate', '>=', now()->startOfMonth())->sum('total');

        $counts = fn ($s) => (int) ($byStatus[$s] ?? 0);

        return [
            'total' => PurchaseOrder::count(),
            'byStatus' => [
                'draft' => $counts('DRAFT'), 'sent' => $counts('SENT'),
                'confirmed' => $counts('CONFIRMED'), 'partial' => $counts('PARTIAL'),
                'received' => $counts('RECEIVED'), 'cancelled' => $counts('CANCELLED'),
            ],
            'pendingCount' => $counts('DRAFT') + $counts('SENT') + $counts('CONFIRMED') + $counts('PARTIAL'),
            'monthlyTotal' => (float) $monthly,
        ];
    }

    /** Detalle con proveedor e ítems; 404 si no existe. */
    public function find(int $id): PurchaseOrder
    {
        return PurchaseOrder::with(self::DETAIL_RELATIONS)->find($id)
            ?? throw new BusinessRuleException('Orden de compra no encontrada', 404);
    }

    /** Crea la orden en borrador con sus ítems (en el orden en que llegaron). */
    public function create(array $data, int $userId): PurchaseOrder
    {
        return DB::transaction(function () use ($data, $userId) {
            $order = PurchaseOrder::create([
                'orderNumber' => $this->numbers->next(NumberSequenceService::PURCHASE_ORDER),
                'supplierId' => $data['supplierId'],
                'status' => 'DRAFT',
                'subtotal' => 0,
                'total' => 0,
                'expectedDate' => $data['expectedDate'] ?? null,
                'notes' => $data['notes'] ?? null,
                'createdById' => $userId,
            ]);
            $order->subtotal = $order->total = $this->writeItems($order, $data['items']);
            $order->save();

            return $order;
        });
    }

    /** La orden existe (404) y está en borrador (400); se llama antes de validar la edición. */
    public function assertEditable(int $id): PurchaseOrder
    {
        $order = PurchaseOrder::find($id) ?? throw new BusinessRuleException('Orden de compra no encontrada', 404);
        if ($order->status !== 'DRAFT') {
            throw new BusinessRuleException('Solo se pueden editar órdenes en estado borrador', 400);
        }

        return $order;
    }

    /** Edita una orden en borrador. Si llegan 'items', reemplazan a los actuales. */
    public function update(int $id, array $data): PurchaseOrder
    {
        $order = $this->assertEditable($id);

        DB::transaction(function () use ($order, $data) {
            $subtotal = (float) $order->subtotal;
            if (array_key_exists('items', $data) && is_array($data['items'])) {
                PurchaseOrderItem::where('purchaseOrderId', $order->id)->delete();
                $subtotal = $this->writeItems($order, $data['items']);
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

        return $order;
    }

    /** Cambio de estado manual según VALID_TRANSITIONS. */
    public function changeStatus(int $id, string $status): PurchaseOrder
    {
        $order = PurchaseOrder::find($id) ?? throw new BusinessRuleException('Orden de compra no encontrada', 404);
        if (! in_array($status, self::VALID_TRANSITIONS[$order->status] ?? [], true)) {
            throw new BusinessRuleException("No se puede cambiar de {$order->status} a {$status}", 400);
        }

        $order->status = $status;
        if ($status === 'RECEIVED') {
            $order->receivedDate = now();
        }
        $order->save();

        return $order;
    }

    /**
     * Borra una orden en borrador o cancelada. Con $force (solo admin) borra en cualquier
     * estado, con sus ítems y los movimientos de inventario de su recepción.
     */
    public function delete(int $id, bool $force): void
    {
        $order = PurchaseOrder::find($id) ?? throw new BusinessRuleException('Orden de compra no encontrada', 404);
        if (! $force && ! in_array($order->status, ['DRAFT', 'CANCELLED'], true)) {
            throw new BusinessRuleException('Solo se pueden eliminar órdenes en borrador o canceladas', 400);
        }

        DB::transaction(function () use ($order) {
            VariantMovement::where('referenceType', 'purchase_order')->where('referenceId', $order->id)->delete();
            InputBatchMovement::where('referenceType', 'purchase_order')->where('referenceId', $order->id)->delete();
            InputVariantMovement::where('referenceType', 'purchase_order')->where('referenceId', $order->id)->delete();
            PurchaseOrderItem::where('purchaseOrderId', $order->id)->delete();
            $order->delete();
        });
    }

    /**
     * Inserta los ítems y devuelve el subtotal. Se ordenan por su posición en la petición:
     * la validación de Laravel arma el arreglo según el orden de las reglas, no el enviado.
     */
    private function writeItems(PurchaseOrder $order, array $items): float
    {
        ksort($items);
        $subtotal = 0;
        foreach ($items as $item) {
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

        return $subtotal;
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
                throw new BusinessRuleException('Orden de compra no encontrada', 404);
            }
            if (! in_array($order->status, ['CONFIRMED', 'PARTIAL'], true)) {
                throw new BusinessRuleException('La orden debe estar confirmada para recibir mercancía', 400);
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
                    throw new BusinessRuleException("No se puede recibir más de {$item->quantity} unidades para el item {$item->id}", 400);
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
        $this->stock->syncProductStock((int) ProductVariant::whereKey($item->variantId)->value('productId'));
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
