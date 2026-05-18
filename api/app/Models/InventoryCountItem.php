<?php

namespace App\Models;

class InventoryCountItem extends BaseModel
{
    protected $table = 'inventory_count_items';

    protected $casts = [
        'isCounted' => 'boolean',
    ];

    public function inventoryCount()
    {
        return $this->belongsTo(InventoryCount::class, 'inventoryCountId');
    }
}
