<?php

namespace App\Models;

class VariantMovement extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'variant_movements';

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'variantId');
    }
}
