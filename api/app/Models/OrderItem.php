<?php

namespace App\Models;

class OrderItem extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'order_items';

    protected $casts = [
        'customization' => 'array',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class, 'orderId');
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'productId');
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'variantId');
    }
}
