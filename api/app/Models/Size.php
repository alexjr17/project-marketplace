<?php

namespace App\Models;

class Size extends BaseModel
{
    protected $table = 'sizes';

    protected $casts = [
        'isActive' => 'boolean',
    ];
}
