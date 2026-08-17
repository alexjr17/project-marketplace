<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgDispatch;
use App\Models\MfgLotItem;
use App\Models\MfgProductMovement;
use App\Models\MfgPurchaseOrder;
use App\Models\MfgWarehouseStock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Despachos / entregas de producto terminado. Al confirmar, descuenta los lotes
 * por FIFO (más antiguo primero) y el stock de bodega, registra el kardex de
 * producto y avanza el estado del pedido según lo entregado.
 */
class MfgDispatchController extends Controller
{
    use ApiResponse;

    private const RELATIONS = [
        'client:id,name,city',
        'purchaseOrder:id,code',
        'warehouse:id,name',
        'items.reference:id,code,name,imagePath',
        'items.color:id,name,hexCode',
        'items.size:id,name,abbreviation,sortOrder',
    ];

    public function index(Request $request)
    {
        $query = MfgDispatch::with(['client:id,name', 'purchaseOrder:id,code'])
            ->withCount('items')
            ->orderByDesc('createdAt');
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('search')) {
            $query->where('code', 'like', '%'.$request->string('search').'%');
        }

        return $this->success($query->get());
    }

    public function show(int $id)
    {
        $d = MfgDispatch::with(self::RELATIONS)->find($id);
        if (! $d) {
            return $this->error('Despacho no encontrado', 404);
        }

        return $this->success($d);
    }

    public function generateNumber()
    {
        return $this->success(['code' => $this->nextCode()]);
    }

    /** Existencias disponibles de producto terminado (suma de lotes con saldo). */
    public function available(Request $request)
    {
        $rows = MfgLotItem::query()
            ->join('mfg_lots', 'mfg_lots.id', '=', 'mfg_lot_items.lotId')
            ->join('mfg_production_orders', 'mfg_production_orders.id', '=', 'mfg_lots.productionOrderId')
            ->join('mfg_references', 'mfg_references.id', '=', 'mfg_production_orders.referenceId')
            ->join('mfg_colors', 'mfg_colors.id', '=', 'mfg_lot_items.colorId')
            ->join('mfg_sizes', 'mfg_sizes.id', '=', 'mfg_lot_items.sizeId')
            ->where('mfg_lot_items.quantityAvailable', '>', 0)
            ->when($request->filled('warehouseId'), fn ($q) => $q->where('mfg_lots.warehouseId', $request->integer('warehouseId')))
            ->groupBy('mfg_production_orders.referenceId', 'mfg_references.code', 'mfg_references.name', 'mfg_references.imagePath',
                'mfg_lot_items.colorId', 'mfg_colors.name', 'mfg_colors.hexCode',
                'mfg_lot_items.sizeId', 'mfg_sizes.abbreviation', 'mfg_sizes.sortOrder')
            ->selectRaw('mfg_production_orders.referenceId as referenceId, mfg_references.code as refCode, mfg_references.name as refName, mfg_references.imagePath as imagePath, '
                .'mfg_lot_items.colorId as colorId, mfg_colors.name as colorName, mfg_colors.hexCode as colorHex, '
                .'mfg_lot_items.sizeId as sizeId, mfg_sizes.abbreviation as sizeAbbr, mfg_sizes.sortOrder as sizeSort, '
                .'SUM(mfg_lot_items.quantityAvailable) as available')
            ->get();

        return $this->success($rows);
    }

    /** Pendiente por despachar de un pedido (pedido − ya despachado confirmado). */
    public function purchaseOrderPending(int $poId)
    {
        $po = MfgPurchaseOrder::with(['items.reference:id,code,name,imagePath', 'items.color:id,name,hexCode', 'items.size:id,name,abbreviation,sortOrder'])->find($poId);
        if (! $po) {
            return $this->error('Pedido no encontrado', 404);
        }
        // Ya despachado (confirmado) para este pedido, por celda.
        $done = MfgDispatch::query()
            ->join('mfg_dispatch_items', 'mfg_dispatch_items.dispatchId', '=', 'mfg_dispatches.id')
            ->where('mfg_dispatches.purchaseOrderId', $poId)
            ->where('mfg_dispatches.status', 'CONFIRMED')
            ->groupBy('mfg_dispatch_items.referenceId', 'mfg_dispatch_items.colorId', 'mfg_dispatch_items.sizeId')
            ->selectRaw('mfg_dispatch_items.referenceId as r, mfg_dispatch_items.colorId as c, mfg_dispatch_items.sizeId as s, SUM(mfg_dispatch_items.quantity) as q')
            ->get()
            ->keyBy(fn ($x) => $x->r.'-'.$x->c.'-'.$x->s);

        $items = $po->items->map(function ($it) use ($done) {
            $key = $it->referenceId.'-'.$it->colorId.'-'.$it->sizeId;
            $dispatched = (int) ($done[$key]->q ?? 0);

            return [
                'referenceId' => $it->referenceId, 'reference' => $it->reference,
                'colorId' => $it->colorId, 'color' => $it->color,
                'sizeId' => $it->sizeId, 'size' => $it->size,
                'ordered' => $it->quantity, 'dispatched' => $dispatched,
                'pending' => max(0, $it->quantity - $dispatched),
            ];
        });

        return $this->success(['purchaseOrder' => ['id' => $po->id, 'code' => $po->code, 'clientId' => $po->clientId], 'items' => $items]);
    }

    public function store(Request $request)
    {
        $data = $this->validateData($request);
        $dispatch = DB::transaction(function () use ($data, $request) {
            $d = MfgDispatch::create([
                'code' => $this->nextCode(),
                'clientId' => $data['clientId'] ?? null,
                'purchaseOrderId' => $data['purchaseOrderId'] ?? null,
                'warehouseId' => $data['warehouseId'] ?? null,
                'type' => $data['type'] ?? 'VENTA',
                'status' => 'DRAFT',
                'shipmentNumber' => $data['shipmentNumber'] ?? null,
                'invoiceNumber' => $data['invoiceNumber'] ?? null,
                'invoicedAt' => $data['invoicedAt'] ?? null,
                'notes' => $data['notes'] ?? null,
                'createdBy' => $request->user()?->id,
            ]);
            $this->syncItems($d, $data['items']);

            return $d;
        });

        return $this->created($dispatch->load(self::RELATIONS), 'Despacho creado');
    }

    public function update(Request $request, int $id)
    {
        $d = MfgDispatch::find($id);
        if (! $d) {
            return $this->error('Despacho no encontrado', 404);
        }
        if ($d->status !== 'DRAFT') {
            return $this->error('Solo se puede editar un despacho en borrador.', 422);
        }
        $data = $this->validateData($request);
        DB::transaction(function () use ($d, $data) {
            $d->update([
                'clientId' => $data['clientId'] ?? null,
                'purchaseOrderId' => $data['purchaseOrderId'] ?? null,
                'warehouseId' => $data['warehouseId'] ?? null,
                'type' => $data['type'] ?? 'VENTA',
                'shipmentNumber' => $data['shipmentNumber'] ?? null,
                'invoiceNumber' => $data['invoiceNumber'] ?? null,
                'invoicedAt' => $data['invoicedAt'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);
            $d->items()->delete();
            $this->syncItems($d, $data['items']);
        });

        return $this->success($d->load(self::RELATIONS), 'Despacho actualizado');
    }

    /** Confirma el despacho: descuenta lotes (FIFO) + bodega + kardex; avanza el pedido. */
    public function confirm(Request $request, int $id)
    {
        $d = MfgDispatch::with('items')->find($id);
        if (! $d) {
            return $this->error('Despacho no encontrado', 404);
        }
        if ($d->status !== 'DRAFT') {
            return $this->error('El despacho ya fue confirmado o anulado.', 422);
        }
        if ($d->items->isEmpty()) {
            return $this->error('El despacho no tiene líneas.', 422);
        }

        try {
            DB::transaction(function () use ($d, $request) {
                foreach ($d->items as $it) {
                    if ($it->quantity <= 0) {
                        continue;
                    }
                    $this->consumeFifo($d, $it, $request->user()?->id);
                }
                $d->status = 'CONFIRMED';
                $d->dispatchedAt = now();
                $d->save();

                // Avanza el estado del pedido si quedó todo entregado.
                if ($d->purchaseOrderId) {
                    $this->refreshPurchaseOrderStatus($d->purchaseOrderId);
                }
            });
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success($d->load(self::RELATIONS), 'Despacho confirmado');
    }

    public function cancel(int $id)
    {
        $d = MfgDispatch::with('items')->find($id);
        if (! $d) {
            return $this->error('Despacho no encontrado', 404);
        }
        if ($d->status === 'CANCELLED') {
            return $this->error('El despacho ya está anulado.', 422);
        }
        DB::transaction(function () use ($d) {
            if ($d->status === 'CONFIRMED') {
                $this->revertDispatch($d);
            }
            $d->status = 'CANCELLED';
            $d->save();
            if ($d->purchaseOrderId) {
                $this->refreshPurchaseOrderStatus($d->purchaseOrderId);
            }
        });

        return $this->success($d->load(self::RELATIONS), 'Despacho anulado');
    }

    /** Registra la remisión / facturación del despacho (puede ser post-confirmación). */
    public function billing(Request $request, int $id)
    {
        $d = MfgDispatch::find($id);
        if (! $d) {
            return $this->error('Despacho no encontrado', 404);
        }
        if ($d->status === 'CANCELLED') {
            return $this->error('El despacho está anulado.', 422);
        }
        $data = $request->validate([
            'shipmentNumber' => 'nullable|string|max:60',
            'invoiceNumber' => 'nullable|string|max:60',
            'invoicedAt' => 'nullable|date',
        ]);
        $d->fill($data)->save();

        return $this->success($d->load(self::RELATIONS), 'Facturación actualizada');
    }

    public function destroy(int $id)
    {
        $d = MfgDispatch::find($id);
        if (! $d) {
            return $this->error('Despacho no encontrado', 404);
        }
        if ($d->status === 'CONFIRMED') {
            return $this->error('No se puede eliminar un despacho confirmado; anúlalo primero.', 422);
        }
        $d->delete();

        return $this->success(null, 'Despacho eliminado');
    }

    // ---- helpers ----

    /** Descuenta una línea de producto por FIFO (lotes más antiguos primero). */
    private function consumeFifo(MfgDispatch $d, $item, ?int $userId): void
    {
        $need = (int) $item->quantity;
        $lots = MfgLotItem::query()
            ->join('mfg_lots', 'mfg_lots.id', '=', 'mfg_lot_items.lotId')
            ->join('mfg_production_orders', 'mfg_production_orders.id', '=', 'mfg_lots.productionOrderId')
            ->where('mfg_production_orders.referenceId', $item->referenceId)
            ->where('mfg_lot_items.colorId', $item->colorId)
            ->where('mfg_lot_items.sizeId', $item->sizeId)
            ->where('mfg_lot_items.quantityAvailable', '>', 0)
            ->when($d->warehouseId, fn ($q) => $q->where('mfg_lots.warehouseId', $d->warehouseId))
            ->orderBy('mfg_lots.createdAt')->orderBy('mfg_lots.id')
            ->select('mfg_lot_items.*', 'mfg_lots.warehouseId as lotWarehouseId', 'mfg_lots.id as parentLotId')
            ->lockForUpdate()->get();

        foreach ($lots as $li) {
            if ($need <= 0) {
                break;
            }
            $take = min($need, (int) $li->quantityAvailable);
            // Descuenta saldo del lote.
            MfgLotItem::where('id', $li->id)->decrement('quantityAvailable', $take);
            // Descuenta stock de la bodega del lote.
            if ($li->lotWarehouseId) {
                $stock = MfgWarehouseStock::where([
                    'warehouseId' => $li->lotWarehouseId, 'referenceId' => $item->referenceId,
                    'colorId' => $item->colorId, 'sizeId' => $item->sizeId,
                ])->first();
                if ($stock) {
                    $stock->quantity = max(0, $stock->quantity - $take);
                    $stock->save();
                }
            }
            // Kardex: salida.
            MfgProductMovement::create([
                'referenceId' => $item->referenceId, 'colorId' => $item->colorId, 'sizeId' => $item->sizeId,
                'warehouseId' => $li->lotWarehouseId, 'lotId' => $li->parentLotId,
                'type' => 'SALIDA', 'quantity' => $take,
                'sourceType' => 'DISPATCH', 'sourceId' => $d->id,
                'notes' => 'Despacho '.$d->code, 'createdBy' => $userId,
            ]);
            $need -= $take;
        }

        if ($need > 0) {
            throw new \RuntimeException("Stock insuficiente para despachar (faltan {$need} und de una referencia/color/talla).");
        }
    }

    /** Devuelve al inventario lo despachado (al anular un despacho confirmado). */
    private function revertDispatch(MfgDispatch $d): void
    {
        $moves = MfgProductMovement::where('sourceType', 'DISPATCH')->where('sourceId', $d->id)->where('type', 'SALIDA')->get();
        foreach ($moves as $m) {
            if ($m->lotId) {
                MfgLotItem::where('lotId', $m->lotId)->where('colorId', $m->colorId)->where('sizeId', $m->sizeId)
                    ->increment('quantityAvailable', $m->quantity);
            }
            if ($m->warehouseId) {
                $stock = MfgWarehouseStock::firstOrNew([
                    'warehouseId' => $m->warehouseId, 'referenceId' => $m->referenceId,
                    'colorId' => $m->colorId, 'sizeId' => $m->sizeId,
                ]);
                $stock->quantity = ($stock->quantity ?? 0) + $m->quantity;
                $stock->save();
            }
        }
        // Contramovimiento de kardex (devolución).
        foreach ($moves as $m) {
            MfgProductMovement::create([
                'referenceId' => $m->referenceId, 'colorId' => $m->colorId, 'sizeId' => $m->sizeId,
                'warehouseId' => $m->warehouseId, 'lotId' => $m->lotId,
                'type' => 'ENTRADA', 'quantity' => $m->quantity,
                'sourceType' => 'DISPATCH', 'sourceId' => $d->id, 'notes' => 'Anulación despacho '.$d->code,
            ]);
        }
    }

    /** Marca el pedido como ENTREGADO si ya se despachó todo lo pedido. */
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

    private function validateData(Request $request): array
    {
        return $request->validate([
            'clientId' => 'nullable|integer|exists:mfg_clients,id',
            'purchaseOrderId' => 'nullable|integer|exists:mfg_purchase_orders,id',
            'warehouseId' => 'nullable|integer|exists:mfg_warehouses,id',
            'type' => 'nullable|in:VENTA,CONSIGNACION,TRASLADO,MUESTRA',
            'shipmentNumber' => 'nullable|string|max:60',
            'invoiceNumber' => 'nullable|string|max:60',
            'invoicedAt' => 'nullable|date',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.referenceId' => 'required|integer|exists:mfg_references,id',
            'items.*.colorId' => 'required|integer|exists:mfg_colors,id',
            'items.*.sizeId' => 'required|integer|exists:mfg_sizes,id',
            'items.*.quantity' => 'required|integer|min:0',
        ]);
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

    private function nextCode(): string
    {
        $year = now()->year;
        $prefix = 'DES-'.$year.'-';
        $last = MfgDispatch::where('code', 'like', $prefix.'%')
            ->orderByRaw('CAST(SUBSTRING_INDEX(code, "-", -1) AS UNSIGNED) DESC')
            ->first();
        $n = $last ? ((int) substr(strrchr($last->code, '-'), 1)) + 1 : 1;

        return sprintf('%s%04d', $prefix, $n);
    }
}
