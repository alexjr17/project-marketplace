<?php

namespace App\Models;

/**
 * Línea de una orden de producción: cantidad por talla y color.
 */
class MfgProductionOrderItem extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'mfg_production_order_items';

    protected $casts = [
        'quantity' => 'integer',
        'quantityDone' => 'integer',
    ];

    public function order()
    {
        return $this->belongsTo(MfgProductionOrder::class, 'productionOrderId');
    }

    public function color()
    {
        return $this->belongsTo(MfgColor::class, 'colorId');
    }

    public function size()
    {
        return $this->belongsTo(MfgSize::class, 'sizeId');
    }
}
