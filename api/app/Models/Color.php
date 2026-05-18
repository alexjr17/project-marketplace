<?php

namespace App\Models;

class Color extends BaseModel
{
    protected $table = 'colors';

    protected $casts = [
        'isActive' => 'boolean',
    ];
}
