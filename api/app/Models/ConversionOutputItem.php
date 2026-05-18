<?php

namespace App\Models;

class ConversionOutputItem extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'conversion_output_items';

    public function conversion()
    {
        return $this->belongsTo(InventoryConversion::class, 'conversionId');
    }
}
