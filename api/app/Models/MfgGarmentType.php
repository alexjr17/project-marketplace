<?php

namespace App\Models;

/**
 * Tipo de prenda de la app Fábrica. Su `code` prefija el código de la referencia.
 */
class MfgGarmentType extends BaseModel
{
    protected $table = 'mfg_garment_types';

    protected $casts = [
        'isActive' => 'boolean',
    ];

    public function sizes()
    {
        return $this->belongsToMany(MfgSize::class, 'mfg_garment_type_sizes', 'garmentTypeId', 'sizeId')
            ->withPivot('market')->orderBy('sortOrder');
    }
}
