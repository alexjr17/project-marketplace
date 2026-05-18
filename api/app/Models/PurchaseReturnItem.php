<?php

namespace App\Models;

class PurchaseReturnItem extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'purchase_return_items';

    public function purchaseReturn()
    {
        return $this->belongsTo(PurchaseReturn::class, 'purchaseReturnId');
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
