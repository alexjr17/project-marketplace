<?php

namespace App\Models;

class Category extends BaseModel
{
    protected $table = 'categories';

    protected $casts = [
        'isActive' => 'boolean',
    ];

    public function productTypes()
    {
        return $this->hasMany(ProductType::class, 'categoryId');
    }

    public function products()
    {
        return $this->hasMany(Product::class, 'categoryId');
    }
}
