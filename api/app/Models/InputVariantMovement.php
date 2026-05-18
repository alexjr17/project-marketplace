<?php

namespace App\Models;

class InputVariantMovement extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'input_variant_movements';

    public function inputVariant()
    {
        return $this->belongsTo(InputVariant::class, 'inputVariantId');
    }
}
