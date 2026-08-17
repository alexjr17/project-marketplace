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
        'fixedCost' => 'decimal:2',
        'factor' => 'decimal:4',
        'factorExport' => 'decimal:4',
    ];

    public function sizes()
    {
        return $this->belongsToMany(MfgSize::class, 'mfg_garment_type_sizes', 'garmentTypeId', 'sizeId')
            ->withPivot('market')->orderBy('sortOrder');
    }

    public function brand()
    {
        return $this->belongsTo(MfgBrand::class, 'brandId');
    }
}
