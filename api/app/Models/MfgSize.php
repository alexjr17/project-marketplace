<?php

namespace App\Models;

/**
 * Talla propia de la app Fábrica.
 */
class MfgSize extends BaseModel
{
    protected $table = 'mfg_sizes';

    protected $casts = [
        'sortOrder' => 'integer',
        'isActive' => 'boolean',
    ];
}
