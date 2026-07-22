<?php

namespace App\Models;

/**
 * Recargo por color dentro de un grupo de tallas (se suma en la venta).
 */
class MfgSizeGroupSurcharge extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'mfg_size_group_surcharges';

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function color()
    {
        return $this->belongsTo(MfgColor::class, 'colorId');
    }
}
