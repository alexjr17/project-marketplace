<?php

namespace App\Models;

class ZoneInput extends BaseModel
{
    protected $table = 'zone_inputs';

    protected $casts = [
        'isLocked' => 'boolean',
    ];

    public function templateZone()
    {
        return $this->belongsTo(TemplateZone::class, 'templateZoneId');
    }

    public function input()
    {
        return $this->belongsTo(Input::class, 'inputId');
    }
}
