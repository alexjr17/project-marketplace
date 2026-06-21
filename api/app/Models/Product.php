<?php

namespace App\Models;

class Product extends BaseModel
{
    protected $table = 'products';

    protected $casts = [
        'images' => 'array',
        'tags' => 'array',
        'zoneTypeImages' => 'array',
        'designZones' => 'array',
        'exclusionZones' => 'array',
        'featured' => 'boolean',
        'isActive' => 'boolean',
        'isTemplate' => 'boolean',
        'discountValue' => 'float',
    ];

    /** Precio efectivo aplicando el descuento directo del producto (si lo hay). */
    public function effectivePrice(): float
    {
        $base = (float) $this->basePrice;
        $value = (float) $this->discountValue;
        if ($value <= 0) {
            return $base;
        }
        if ($this->discountType === 'percent') {
            return max(0, round($base - $base * ($value / 100)));
        }
        if ($this->discountType === 'fixed') {
            return max(0, $base - $value);
        }

        return $base;
    }

    public function category()
    {
        return $this->belongsTo(Category::class, 'categoryId');
    }

    public function productType()
    {
        return $this->belongsTo(ProductType::class, 'typeId');
    }

    public function productColors()
    {
        return $this->hasMany(ProductColor::class, 'productId');
    }

    public function productSizes()
    {
        return $this->hasMany(ProductSize::class, 'productId');
    }

    public function variants()
    {
        return $this->hasMany(ProductVariant::class, 'productId');
    }

    public function productInputs()
    {
        return $this->hasMany(ProductInput::class, 'productId');
    }

    public function templateZones()
    {
        return $this->hasMany(TemplateZone::class, 'templateId');
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class, 'productId');
    }

    public function reviews()
    {
        return $this->hasMany(Review::class, 'productId');
    }
}
