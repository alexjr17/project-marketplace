<?php

namespace App\Models;

class LabelTemplate extends BaseModel
{
    protected $table = 'label_templates';

    protected $casts = [
        'isDefault' => 'boolean',
        'isActive' => 'boolean',
    ];

    public function zones()
    {
        return $this->hasMany(LabelZone::class, 'labelTemplateId');
    }

    public function productTypes()
    {
        return $this->hasMany(LabelTemplateProductType::class, 'labelTemplateId');
    }
}
