<?php

namespace App\Models;

class TemplateRecipe extends BaseModel
{
    protected $table = 'template_recipes';

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'variantId');
    }

    public function inputVariant()
    {
        return $this->belongsTo(InputVariant::class, 'inputVariantId');
    }
}
