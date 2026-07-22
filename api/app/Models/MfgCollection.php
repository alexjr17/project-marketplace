<?php

namespace App\Models;

/**
 * Colección (año + semestre) de la app Fábrica.
 */
class MfgCollection extends BaseModel
{
    protected $table = 'mfg_collections';

    protected $casts = [
        'year' => 'integer',
        'isActive' => 'boolean',
    ];
}
