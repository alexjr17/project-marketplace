<?php

namespace App\Models;

/**
 * Talla incluida en un grupo de tallas.
 */
class MfgSizeGroupSize extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'mfg_size_group_sizes';

    public function size()
    {
        return $this->belongsTo(MfgSize::class, 'sizeId');
    }
}
