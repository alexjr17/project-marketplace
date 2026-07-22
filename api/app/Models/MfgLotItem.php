<?php

namespace App\Models;

/**
 * Línea de un lote de producto terminado (color × talla).
 */
class MfgLotItem extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'mfg_lot_items';

    protected $casts = [
        'quantityProduced' => 'integer',
        'quantityAvailable' => 'integer',
    ];

    public function color()
    {
        return $this->belongsTo(MfgColor::class, 'colorId');
    }

    public function size()
    {
        return $this->belongsTo(MfgSize::class, 'sizeId');
    }
}
