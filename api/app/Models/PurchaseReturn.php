<?php

namespace App\Models;

class PurchaseReturn extends BaseModel
{
    protected $table = 'purchase_returns';

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class, 'purchaseOrderId');
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplierId');
    }

    public function items()
    {
        return $this->hasMany(PurchaseReturnItem::class, 'purchaseReturnId');
    }
}
