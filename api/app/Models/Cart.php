<?php

namespace App\Models;

class Cart extends BaseModel
{
    protected $table = 'carts';

    public function user()
    {
        return $this->belongsTo(User::class, 'userId');
    }

    public function items()
    {
        return $this->hasMany(CartItem::class, 'cartId');
    }
}
