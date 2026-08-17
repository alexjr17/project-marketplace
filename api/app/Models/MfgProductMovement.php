<?php

namespace App\Models;

/** Kardex de producto terminado (entradas de lote, salidas de despacho, ajustes). */
class MfgProductMovement extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'mfg_product_movements';

    protected $casts = [
        'quantity' => 'integer',
    ];

    public function reference()
    {
        return $this->belongsTo(MfgReference::class, 'referenceId');
    }

    public function color()
    {
        return $this->belongsTo(MfgColor::class, 'colorId');
    }

    public function size()
    {
        return $this->belongsTo(MfgSize::class, 'sizeId');
    }

    public function warehouse()
    {
        return $this->belongsTo(MfgWarehouse::class, 'warehouseId');
    }
}
