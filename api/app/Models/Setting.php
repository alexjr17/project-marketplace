<?php

namespace App\Models;

class Setting extends BaseModel
{
    const CREATED_AT = null;

    protected $table = 'settings';

    protected $casts = [
        'value' => 'array',
    ];
}
