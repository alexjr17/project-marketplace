<?php

namespace App\Services\Manufacturing;

use App\Exceptions\BusinessRuleException;
use App\Models\MfgDispatch;
use App\Models\MfgLotItem;
use App\Models\MfgPurchaseOrder;
use App\Models\MfgWarehouseStock;
use App\Services\NumberSequenceService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Despachos / entregas de producto terminado. Al confirmar se descuentan los lotes por FIFO
 * (más antiguo primero) y la bodega, se registra el kardex (MfgFinishedStockService) y se
 * avanza el estado del pedido según lo entregado.
 */
class MfgDispatchService
{
    public const RELATIONS = [
        'client:id,name,city',
        'purchaseOrder:id,code',
        'warehouse:id,name',
        'items.reference:id,code,name,imagePath',
        'items.color:id,name,hexCode',
        'items.size:id,name,abbreviation,sortOrder',
    ];

    public function __construct(
        private NumberSequenceService $numbers,
        private MfgFinishedStockService $finished,
    ) {}

    /** @param array{status?:?string, search?:?string} $filters */
    public function list(array $filters = []): Collection
    {
        $query = MfgDispatch::with(['client:id,name', 'purchaseOrder:id,code'])
            ->withCount('items')
            ->orderByDesc('createdAt');
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['search'])) {
            $query->where('code', 'like', '%'.$filters['search'].'%');
        }

        return $query->get();
    }

    public function detail(int $id): MfgDispatch
    {
        return $this->findOrFail($id)->load(self::RELATIONS);
    }

    public function peekCode(): string
    {
        return $this->numbers->peek(NumberSequenceService::MFG_DISPATCH);
    }

    /** Existencias disponibles de producto terminado (suma de lotes con saldo). */
    public function available(?int $warehouseId)
    {
        return MfgLotItem::query()
            ->join('mfg_lots', 'mfg_lots.id', '=', 'mfg_lot_items.lotId')
            ->join('mfg_production_orders', 'mfg_production_orders.id', '=', 'mfg_lots.productionOrderId')
            ->join('mfg_references', 'mfg_references.id', '=', 'mfg_production_orders.referenceId')
            ->join('mfg_colors', 'mfg_colors.id', '=', 'mfg_lot_items.colorId')
            ->join('mfg_sizes', 'mfg_sizes.id', '=', 'mfg_lot_items.sizeId')
            ->where('mfg_lot_items.quantityAvailable', '>', 0)
            ->when($warehouseId, fn ($q) => $q->where('mfg_lots.warehouseId', $warehouseId))
            ->groupBy('mfg_production_orders.referenceId', 'mfg_references.code', 'mfg_references.name', 'mfg_references.imagePath',
                'mfg_lot_items.colorId', 'mfg_colors.name', 'mfg_colors.hexCode',
                'mfg_lot_items.sizeId', 'mfg_sizes.abbreviation', 'mfg_sizes.sortOrder')
            ->selectRaw('mfg_production_orders.referenceId as referenceId, mfg_references.code as refCode, mfg_references.name as refName, mfg_references.imagePath as imagePath, '
                .'mfg_lot_items.colorId as colorId, mfg_colors.name as colorName, mfg_colors.hexCode as colorHex, '
                .'mfg_lot_items.sizeId as sizeId, mfg_sizes.abbreviation as sizeAbbr, mfg_sizes.sortOrder as sizeSort, '
                .'SUM(mfg_lot_items.quantityAvailable) as available')
            ->get();
    }

    /** Pendiente por despachar de un pedido (pedido − ya despachado confirmado). */
    public function purchaseOrderPending(int $poId): array
    {
        $po = MfgPurchaseOrder::with(['items.reference:id,code,name,imagePath', 'items.color:id,name,hexCode', 'items.size:id,name,abbreviation,sortOrder'])->find($poId);
        if (! $po) {
            throw new BusinessRuleException('Pedido no encontrado', 404);
        }
        $done = MfgDispatch::query()
            ->join('mfg_dispatch_items', 'mfg_dispatch_items.dispatchId', '=', 'mfg_dispatches.id')
            ->where('mfg_dispatches.purchaseOrderId', $poId)
            ->where('mfg_dispatches.status', 'CONFIRMED')
            ->groupBy('mfg_dispatch_items.referenceId', 'mfg_dispatch_items.colorId', 'mfg_dispatch_items.sizeId')
            ->selectRaw('mfg_dispatch_items.referenceId as r, mfg_dispatch_items.colorId as c, mfg_dispatch_items.sizeId as s, SUM(mfg_dispatch_items.quantity) as q')
            ->get()
            ->keyBy(fn ($x) => $x->r.'-'.$x->c.'-'.$x->s);

        $items = $po->items->map(function ($it) use ($done) {
            $dispatched = (int) ($done[$it->referenceId.'-'.$it->colorId.'-'.$it->sizeId]->q ?? 0);

            return [
                'referenceId' => $it->referenceId, 'reference' => $it->reference,
                'colorId' => $it->colorId, 'color' => $it->color,
                'sizeId' => $it->sizeId, 'size' => $it->size,
                'ordered' => $it->quantity, 'dispatched' => $dispatched,
                'pending' => max(0, $it->quantity - $dispatched),
            ];
        });

        return ['purchaseOrder' => ['id' => $po->id, 'code' => $po->code, 'clientId' => $po->clientId], 'items' => $items];
    }

    public function create(array $data, ?int $userId): MfgDispatch
    {
        $dispatch = DB::transaction(function () use ($data, $userId) {
            $d = MfgDispatch::create(array_merge($this->header($data), [
                'code' => $this->numbers->next(NumberSequenceService::MFG_DISPATCH),
                'status' => 'DRAFT',
                'createdBy' => $userId,
            ]));
            $this->syncItems($d, $data['items']);

            return $d;
        });

        return $dispatch->load(self::RELATIONS);
    }

    /** 404 si no existe; 422 si ya no es borrador. */
    public function assertDraft(int $id): MfgDispatch
    {
        $d = $this->findOrFail($id);
        if ($d->status !== 'DRAFT') {
            throw new BusinessRuleException('Solo se puede editar un despacho en borrador.');
        }

        return $d;
    }

    public function update(int $id, array $data): MfgDispatch
    {
        $d = $this->assertDraft($id);
        DB::transaction(function () use ($d, $data) {
            $d->update($this->header($data));
            $d->items()->delete();
            $this->syncItems($d, $data['items']);
        });

        return $d->load(self::RELATIONS);
    }

    /** Confirma el despacho: descuenta lotes (FIFO) + bodega + kardex; avanza el pedido. */
    public function confirm(int $id, ?int $userId): MfgDispatch
    {
        $d = MfgDispatch::with('items')->find($id);
        if (! $d) {
            throw new BusinessRuleException('Despacho no encontrado', 404);
        }
        if ($d->status !== 'DRAFT') {
            throw new BusinessRuleException('El despacho ya fue confirmado o anulado.');
        }
        if ($d->items->isEmpty()) {
            throw new BusinessRuleException('El despacho no tiene líneas.');
        }

        DB::transaction(function () use ($d, $userId) {
            foreach ($d->items as $it) {
                if ($it->quantity <= 0) {
                    continue;
                }
                $this->finished->dispatchFifo($d, $it->referenceId, $it->colorId, $it->sizeId, (int) $it->quantity, $userId);
            }
            $d->status = 'CONFIRMED';
            $d->dispatchedAt = now();
            $d->save();

            if ($d->purchaseOrderId) {
                $this->refreshPurchaseOrderStatus($d->purchaseOrderId);
            }
        });

        return $d->load(self::RELATIONS);
    }

    /**
     * Anula el despacho. Si estaba confirmado devuelve el producto a lotes y bodega y recalcula
     * el estado del pedido; un borrador anulado no movió nada, así que el pedido no cambia
     * (antes un pedido APROBADO pasaba a IN_PRODUCTION al anular un borrador).
     */
    public function cancel(int $id): MfgDispatch
    {
        $d = MfgDispatch::with('items')->find($id);
        if (! $d) {
            throw new BusinessRuleException('Despacho no encontrado', 404);
        }
        if ($d->status === 'CANCELLED') {
            throw new BusinessRuleException('El despacho ya está anulado.');
        }
        DB::transaction(function () use ($d) {
            $wasConfirmed = $d->status === 'CONFIRMED';
            if ($wasConfirmed) {
                $this->finished->revertDispatch($d);
            }
            $d->status = 'CANCELLED';
            $d->save();
            if ($wasConfirmed && $d->purchaseOrderId) {
                $this->refreshPurchaseOrderStatus($d->purchaseOrderId);
            }
        });

        return $d->load(self::RELATIONS);
    }

    /** 404 si no existe; 422 si está anulado (la facturación no aplica). */
    public function assertBillable(int $id): MfgDispatch
    {
        $d = $this->findOrFail($id);
        if ($d->status === 'CANCELLED') {
            throw new BusinessRuleException('El despacho está anulado.');
        }

        return $d;
    }

    /** Registra la remisión / facturación del despacho (puede ser post-confirmación). */
    public function billing(int $id, array $data): MfgDispatch
    {
        $d = $this->assertBillable($id);
        $d->fill($data)->save();

        return $d->load(self::RELATIONS);
    }

    public function delete(int $id): void
    {
        $d = $this->findOrFail($id);
        if ($d->status === 'CONFIRMED') {
            throw new BusinessRuleException('No se puede eliminar un despacho confirmado; anúlalo primero.');
        }
        $d->delete();
    }

    /** Inventario de producto terminado por bodega (llenado por los lotes de producción). */
    public function warehouseStock(?int $warehouseId): Collection
    {
        return MfgWarehouseStock::with([
            'warehouse:id,name',
            'reference:id,code,name',
            'color:id,name,hexCode',
            'size:id,name,abbreviation,sortOrder',
        ])->where('quantity', '>', 0)
            ->when($warehouseId, fn ($q) => $q->where('warehouseId', $warehouseId))
            ->get();
    }

    // ---- reglas internas ----

    private function findOrFail(int $id): MfgDispatch
    {
        $d = MfgDispatch::find($id);
        if (! $d) {
            throw new BusinessRuleException('Despacho no encontrado', 404);
        }

        return $d;
    }

    /** Campos de cabecera del despacho (un PUT sin type vuelve a VENTA y sin cliente lo borra). */
    private function header(array $data): array
    {
        return [
            'clientId' => $data['clientId'] ?? null,
            'purchaseOrderId' => $data['purchaseOrderId'] ?? null,
            'warehouseId' => $data['warehouseId'] ?? null,
            'type' => $data['type'] ?? 'VENTA',
            'shipmentNumber' => $data['shipmentNumber'] ?? null,
            'invoiceNumber' => $data['invoiceNumber'] ?? null,
            'invoicedAt' => $data['invoicedAt'] ?? null,
            'notes' => $data['notes'] ?? null,
        ];
    }

    /** Marca el pedido como ENTREGADO si ya se despachó todo lo pedido (si no, en producción). */
    private function refreshPurchaseOrderStatus(int $poId): void
    {
        $po = MfgPurchaseOrder::with('items')->find($poId);
        if (! $po || in_array($po->status, ['CANCELLED', 'DRAFT'], true)) {
            return;
        }
        $ordered = (int) $po->items->sum('quantity');
        $dispatched = (int) MfgDispatch::query()
            ->join('mfg_dispatch_items', 'mfg_dispatch_items.dispatchId', '=', 'mfg_dispatches.id')
            ->where('mfg_dispatches.purchaseOrderId', $poId)
            ->where('mfg_dispatches.status', 'CONFIRMED')
            ->sum('mfg_dispatch_items.quantity');

        $po->status = ($ordered > 0 && $dispatched >= $ordered) ? 'DELIVERED' : 'IN_PRODUCTION';
        $po->save();
    }

    private function syncItems(MfgDispatch $d, array $items): void
    {
        foreach ($items as $it) {
            if ((int) $it['quantity'] <= 0) {
                continue;
            }
            $d->items()->create([
                'referenceId' => $it['referenceId'], 'colorId' => $it['colorId'],
                'sizeId' => $it['sizeId'], 'quantity' => $it['quantity'],
            ]);
        }
    }
}
