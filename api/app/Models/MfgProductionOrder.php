<?php

namespace App\Models;

/**
 * Orden de producción de la app Fábrica. La creación (código, matriz y etapas) la hace
 * App\Services\Manufacturing\MfgProductionOrderService.
 */
class MfgProductionOrder extends BaseModel
{
    protected $table = 'mfg_production_orders';

    protected $casts = [
        'startedAt' => 'datetime',
        'finishedAt' => 'datetime',
        'scheduledAt' => 'datetime',
        'estimatedDeliveryAt' => 'datetime',
    ];

    public function reference()
    {
        return $this->belongsTo(MfgReference::class, 'referenceId');
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(MfgPurchaseOrder::class, 'purchaseOrderId');
    }

    public function warehouse()
    {
        return $this->belongsTo(MfgWarehouse::class, 'warehouseId');
    }

    public function collection()
    {
        return $this->belongsTo(MfgCollection::class, 'collectionId');
    }

    public function items()
    {
        return $this->hasMany(MfgProductionOrderItem::class, 'productionOrderId');
    }

    public function stages()
    {
        return $this->hasMany(MfgProductionOrderStage::class, 'productionOrderId');
    }

    public function lots()
    {
        return $this->hasMany(MfgLot::class, 'productionOrderId');
    }

    public function substitutions()
    {
        return $this->hasMany(MfgOrderInputSubstitution::class, 'productionOrderId');
    }
}
