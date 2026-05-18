<?php

namespace App\Models;

class InventoryConversion extends BaseModel
{
    protected $table = 'inventory_conversions';

    protected $casts = [
        'conversionDate' => 'datetime',
        'approvedAt' => 'datetime',
    ];

    public function inputItems()
    {
        return $this->hasMany(ConversionInputItem::class, 'conversionId');
    }

    public function outputItems()
    {
        return $this->hasMany(ConversionOutputItem::class, 'conversionId');
    }
}
