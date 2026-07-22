<?php

namespace App\Models;

/**
 * Lote de producto terminado, creado al cerrar la última etapa de una orden.
 */
class MfgLot extends BaseModel
{
    protected $table = 'mfg_lots';

    public function order()
    {
        return $this->belongsTo(MfgProductionOrder::class, 'productionOrderId');
    }

    public function warehouse()
    {
        return $this->belongsTo(MfgWarehouse::class, 'warehouseId');
    }

    public function items()
    {
        return $this->hasMany(MfgLotItem::class, 'lotId');
    }
}
