<?php

namespace App\Models;

class ProductColor extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'product_colors';

    public function product()
    {
        return $this->belongsTo(Product::class, 'productId');
    }

    public function color()
    {
        return $this->belongsTo(Color::class, 'colorId');
    }
}
