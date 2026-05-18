<?php

namespace App\Models;

class PurchaseOrderItem extends BaseModel
{
    protected $table = 'purchase_order_items';

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class, 'purchaseOrderId');
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'variantId');
    }

    public function input()
    {
        return $this->belongsTo(Input::class, 'inputId');
    }

    public function inputVariant()
    {
        return $this->belongsTo(InputVariant::class, 'inputVariantId');
    }
}
