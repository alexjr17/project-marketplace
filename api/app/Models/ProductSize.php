<?php

namespace App\Models;

class ProductSize extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'product_sizes';

    public function product()
    {
        return $this->belongsTo(Product::class, 'productId');
    }

    public function size()
    {
        return $this->belongsTo(Size::class, 'sizeId');
    }
}
