<?php

namespace App\Models;

/** Marca de la app Fábrica (catálogo propio). */
class MfgBrand extends BaseModel
{
    protected $table = 'mfg_brands';

    protected $casts = [
        'isActive' => 'boolean',
    ];
}
