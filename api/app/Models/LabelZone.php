<?php

namespace App\Models;

class LabelZone extends BaseModel
{
    protected $table = 'label_zones';

    protected $casts = [
        'showLabel' => 'boolean',
    ];

    public function labelTemplate()
    {
        return $this->belongsTo(LabelTemplate::class, 'labelTemplateId');
    }
}
