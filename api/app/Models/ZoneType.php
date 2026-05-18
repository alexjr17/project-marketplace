<?php

namespace App\Models;

class ZoneType extends BaseModel
{
    protected $table = 'zone_types';

    protected $casts = [
        'isActive' => 'boolean',
    ];

    public function zones()
    {
        return $this->hasMany(TemplateZone::class, 'zoneTypeId');
    }
}
