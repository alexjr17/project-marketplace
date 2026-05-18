<?php

namespace App\Models;

class TemplateZone extends BaseModel
{
    protected $table = 'template_zones';

    protected $casts = [
        'points' => 'array',
        'isEditable' => 'boolean',
        'isRequired' => 'boolean',
        'isBlocked' => 'boolean',
        'isActive' => 'boolean',
    ];

    public function template()
    {
        return $this->belongsTo(Product::class, 'templateId');
    }

    public function zoneType()
    {
        return $this->belongsTo(ZoneType::class, 'zoneTypeId');
    }

    public function zoneInput()
    {
        return $this->hasOne(ZoneInput::class, 'templateZoneId');
    }
}
