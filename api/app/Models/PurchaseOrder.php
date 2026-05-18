<?php

namespace App\Models;

class PurchaseOrder extends BaseModel
{
    protected $table = 'purchase_orders';

    protected $casts = [
        'orderDate' => 'datetime',
        'expectedDate' => 'datetime',
        'receivedDate' => 'datetime',
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplierId');
    }

    public function items()
    {
        return $this->hasMany(PurchaseOrderItem::class, 'purchaseOrderId');
    }
}
