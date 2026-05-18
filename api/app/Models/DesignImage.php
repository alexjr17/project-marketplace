<?php

namespace App\Models;

class DesignImage extends BaseModel
{
    protected $table = 'design_images';

    protected $casts = [
        'tags' => 'array',
        'isActive' => 'boolean',
    ];
}
