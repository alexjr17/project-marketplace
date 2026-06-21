<?php

namespace App\Models;

class Discount extends BaseModel
{
    protected $table = 'discounts';

    protected $casts = [
        'value' => 'float',
        'targetIds' => 'array',
        'minSubtotal' => 'float',
        'maxUses' => 'integer',
        'maxUsesPerUser' => 'integer',
        'usedCount' => 'integer',
        'isActive' => 'boolean',
        'startsAt' => 'datetime',
        'endsAt' => 'datetime',
    ];
}
