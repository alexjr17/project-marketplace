<?php

namespace App\Models;

class ProductType extends BaseModel
{
    protected $table = 'product_types';

    protected $casts = [
        'isActive' => 'boolean',
    ];

    public function category()
    {
        return $this->belongsTo(Category::class, 'categoryId');
    }

    public function products()
    {
        return $this->hasMany(Product::class, 'typeId');
    }

    public function productTypeSizes()
    {
        return $this->hasMany(ProductTypeSize::class, 'productTypeId');
    }

    public function labelTemplates()
    {
        return $this->hasMany(LabelTemplateProductType::class, 'productTypeId');
    }
}
