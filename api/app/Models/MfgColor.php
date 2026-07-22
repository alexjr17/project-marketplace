<?php

namespace App\Models;

/**
 * Color propio de la app Fábrica.
 */
class MfgColor extends BaseModel
{
    protected $table = 'mfg_colors';

    protected $casts = [
        'isActive' => 'boolean',
    ];
}
