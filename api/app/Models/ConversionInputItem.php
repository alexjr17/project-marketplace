<?php

namespace App\Models;

class ConversionInputItem extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'conversion_input_items';

    public function conversion()
    {
        return $this->belongsTo(InventoryConversion::class, 'conversionId');
    }
}
