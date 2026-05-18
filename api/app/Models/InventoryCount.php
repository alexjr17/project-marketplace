<?php

namespace App\Models;

class InventoryCount extends BaseModel
{
    protected $table = 'inventory_counts';

    protected $casts = [
        'countDate' => 'datetime',
        'approvedAt' => 'datetime',
    ];

    public function items()
    {
        return $this->hasMany(InventoryCountItem::class, 'inventoryCountId');
    }
}
