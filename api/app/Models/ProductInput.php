<?php

namespace App\Models;

class ProductInput extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'product_inputs';

    public function product()
    {
        return $this->belongsTo(Product::class, 'productId');
    }

    public function input()
    {
        return $this->belongsTo(Input::class, 'inputId');
    }
}
