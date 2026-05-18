<?php

namespace App\Models;

class ProductTypeSize extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'product_type_sizes';

    public function productType()
    {
        return $this->belongsTo(ProductType::class, 'productTypeId');
    }

    public function size()
    {
        return $this->belongsTo(Size::class, 'sizeId');
    }
}
