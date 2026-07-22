<?php

namespace App\Models;

/**
 * Bodega donde queda el producto terminado de la fábrica.
 */
class MfgWarehouse extends BaseModel
{
    protected $table = 'mfg_warehouses';

    protected $casts = [
        'isActive' => 'boolean',
    ];
}
