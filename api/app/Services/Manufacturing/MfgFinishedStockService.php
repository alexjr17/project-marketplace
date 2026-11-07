<?php

namespace App\Services\Manufacturing;

use App\Exceptions\BusinessRuleException;
use App\Models\MfgDispatch;
use App\Models\MfgLot;
use App\Models\MfgLotItem;
use App\Models\MfgProductMovement;
use App\Models\MfgWarehouseStock;

/**
 * Stock de producto terminado de Fábrica: saldo de los lotes (mfg_lot_items), existencias por
 * bodega (mfg_warehouse_stock) y kardex (mfg_product_movements). Es el equivalente de
 * StockService para Fábrica: la producción (entrada del lote) y los despachos (salida FIFO,
 * anulación) mueven el stock solo por aquí.
 *
 * Llamarlo dentro de la transacción del documento (lote, despacho).
 */
class MfgFinishedStockService
{
    /** Suma (o resta, con $delta negativo) a la existencia de bodega de una celda; nunca queda negativa. */
    public function addToWarehouse(int $warehouseId, int $referenceId, int $colorId, int $sizeId, int $delta): void
    {
        $stock = MfgWarehouseStock::firstOrNew([
            'warehouseId' => $warehouseId, 'referenceId' => $referenceId,
            'colorId' => $colorId, 'sizeId' => $sizeId,
        ]);
        if (! $stock->exists && $delta <= 0) {
            return;
        }
        $stock->quantity = max(0, (int) ($stock->quantity ?? 0) + $delta);
        $stock->updatedAt = now();
        $stock->save();
    }

    /** Entrada de un lote recién creado: llena la bodega y deja el kardex de ENTRADA por celda. */
    public function receiveLot(MfgLot $lot, int $referenceId): void
    {
        foreach ($lot->items()->get() as $it) {
            if ($lot->warehouseId) {
                $this->addToWarehouse($lot->warehouseId, $referenceId, $it->colorId, $it->sizeId, (int) $it->quantityProduced);
            }
            MfgProductMovement::create([
                'referenceId' => $referenceId, 'colorId' => $it->colorId, 'sizeId' => $it->sizeId,
                'warehouseId' => $lot->warehouseId, 'lotId' => $lot->id,
                'type' => 'ENTRADA', 'quantity' => $it->quantityProduced,
                'sourceType' => 'LOT', 'sourceId' => $lot->id, 'notes' => 'Lote '.$lot->code,
            ]);
        }
    }

    /** Revierte un lote (reapertura de la última etapa): descuenta su saldo de la bodega y borra su kardex. */
    public function revertLot(MfgLot $lot, int $referenceId): void
    {
        if ($lot->warehouseId) {
            foreach ($lot->items()->get() as $it) {
                $this->addToWarehouse($lot->warehouseId, $referenceId, $it->colorId, $it->sizeId, -(int) $it->quantityAvailable);
            }
        }
        MfgProductMovement::where('sourceType', 'LOT')->where('sourceId', $lot->id)->delete();
    }

    /**
     * Saca una línea de despacho por FIFO (lotes más antiguos primero): baja el saldo del lote
     * y la bodega y deja el kardex de SALIDA. Si no alcanza, lanza 422 (y la transacción se deshace).
     */
    public function dispatchFifo(MfgDispatch $dispatch, int $referenceId, int $colorId, int $sizeId, int $quantity, ?int $userId): void
    {
        $need = $quantity;
        $lots = MfgLotItem::query()
            ->join('mfg_lots', 'mfg_lots.id', '=', 'mfg_lot_items.lotId')
            ->join('mfg_production_orders', 'mfg_production_orders.id', '=', 'mfg_lots.productionOrderId')
            ->where('mfg_production_orders.referenceId', $referenceId)
            ->where('mfg_lot_items.colorId', $colorId)
            ->where('mfg_lot_items.sizeId', $sizeId)
            ->where('mfg_lot_items.quantityAvailable', '>', 0)
            ->when($dispatch->warehouseId, fn ($q) => $q->where('mfg_lots.warehouseId', $dispatch->warehouseId))
            ->orderBy('mfg_lots.createdAt')->orderBy('mfg_lots.id')
            ->select('mfg_lot_items.*', 'mfg_lots.warehouseId as lotWarehouseId', 'mfg_lots.id as parentLotId')
            ->lockForUpdate()->get();

        foreach ($lots as $li) {
            if ($need <= 0) {
                break;
            }
            $take = min($need, (int) $li->quantityAvailable);
            MfgLotItem::where('id', $li->id)->decrement('quantityAvailable', $take);
            if ($li->lotWarehouseId) {
                $this->addToWarehouse((int) $li->lotWarehouseId, $referenceId, $colorId, $sizeId, -$take);
            }
            MfgProductMovement::create([
                'referenceId' => $referenceId, 'colorId' => $colorId, 'sizeId' => $sizeId,
                'warehouseId' => $li->lotWarehouseId, 'lotId' => $li->parentLotId,
                'type' => 'SALIDA', 'quantity' => $take,
                'sourceType' => 'DISPATCH', 'sourceId' => $dispatch->id,
                'notes' => 'Despacho '.$dispatch->code, 'createdBy' => $userId,
            ]);
            $need -= $take;
        }

        if ($need > 0) {
            throw new BusinessRuleException("Stock insuficiente para despachar (faltan {$need} und de una referencia/color/talla).");
        }
    }

    /** Devuelve al lote y a la bodega lo que salió con un despacho confirmado (con contramovimiento). */
    public function revertDispatch(MfgDispatch $dispatch): void
    {
        $moves = MfgProductMovement::where('sourceType', 'DISPATCH')->where('sourceId', $dispatch->id)->where('type', 'SALIDA')->get();
        foreach ($moves as $m) {
            if ($m->lotId) {
                MfgLotItem::where('lotId', $m->lotId)->where('colorId', $m->colorId)->where('sizeId', $m->sizeId)
                    ->increment('quantityAvailable', $m->quantity);
            }
            if ($m->warehouseId) {
                $this->addToWarehouse($m->warehouseId, $m->referenceId, $m->colorId, $m->sizeId, (int) $m->quantity);
            }
        }
        foreach ($moves as $m) {
            MfgProductMovement::create([
                'referenceId' => $m->referenceId, 'colorId' => $m->colorId, 'sizeId' => $m->sizeId,
                'warehouseId' => $m->warehouseId, 'lotId' => $m->lotId,
                'type' => 'ENTRADA', 'quantity' => $m->quantity,
                'sourceType' => 'DISPATCH', 'sourceId' => $dispatch->id, 'notes' => 'Anulación despacho '.$dispatch->code,
            ]);
        }
    }
}
