<?php

namespace App\Models;

class LabelTemplateProductType extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'label_template_product_types';

    public function labelTemplate()
    {
        return $this->belongsTo(LabelTemplate::class, 'labelTemplateId');
    }

    public function productType()
    {
        return $this->belongsTo(ProductType::class, 'productTypeId');
    }
}
