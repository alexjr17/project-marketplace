<?php

namespace App\Models;

class InputVariant extends BaseModel
{
    protected $table = 'input_variants';

    protected $casts = [
        'isActive' => 'boolean',
    ];

    public function input()
    {
        return $this->belongsTo(Input::class, 'inputId');
    }

    public function color()
    {
        return $this->belongsTo(Color::class, 'colorId');
    }

    public function size()
    {
        return $this->belongsTo(Size::class, 'sizeId');
    }

    public function purchaseOrderItems()
    {
        return $this->hasMany(PurchaseOrderItem::class, 'inputVariantId');
    }

    public function movements()
    {
        return $this->hasMany(InputVariantMovement::class, 'inputVariantId');
    }

    public function templateRecipes()
    {
        return $this->hasMany(TemplateRecipe::class, 'inputVariantId');
    }
}
