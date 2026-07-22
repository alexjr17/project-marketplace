<?php

namespace App\Models;

/**
 * Stock de producto terminado por bodega (referencia × color × talla).
 */
class MfgWarehouseStock extends BaseModel
{
    const CREATED_AT = null;

    protected $table = 'mfg_warehouse_stock';

    protected $casts = [
        'quantity' => 'integer',
    ];

    public function warehouse()
    {
        return $this->belongsTo(MfgWarehouse::class, 'warehouseId');
    }

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
}
