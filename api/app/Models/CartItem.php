<?php

namespace App\Models;

class CartItem extends BaseModel
{
    protected $table = 'cart_items';

    protected $casts = [
        'isCustomized' => 'boolean',
        'customization' => 'array',
    ];

    public function cart()
    {
        return $this->belongsTo(Cart::class, 'cartId');
    }
}
