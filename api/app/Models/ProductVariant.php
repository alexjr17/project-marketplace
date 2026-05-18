<?php

namespace App\Models;

class ProductVariant extends BaseModel
{
    protected $table = 'product_variants';

    protected $casts = [
        'isActive' => 'boolean',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class, 'productId');
    }

    public function color()
    {
        return $this->belongsTo(Color::class, 'colorId');
    }

    public function size()
    {
        return $this->belongsTo(Size::class, 'sizeId');
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class, 'variantId');
    }

    public function purchaseOrderItems()
    {
        return $this->hasMany(PurchaseOrderItem::class, 'variantId');
    }

    public function movements()
    {
        return $this->hasMany(VariantMovement::class, 'variantId');
    }

    public function templateRecipes()
    {
        return $this->hasMany(TemplateRecipe::class, 'variantId');
    }
}
