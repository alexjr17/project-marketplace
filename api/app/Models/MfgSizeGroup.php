<?php

namespace App\Models;

/**
 * Grupo de tallas de una referencia = lista de precio. Agrupa varias tallas
 * con un mismo precio para un mercado, con recargo por color.
 */
class MfgSizeGroup extends BaseModel
{
    protected $table = 'mfg_size_groups';

    protected $casts = [
        'fixedCostExtra' => 'decimal:2',
        'factor' => 'decimal:4',
        'listPrice' => 'decimal:2',
        'isWholesale' => 'boolean',
        'sortOrder' => 'integer',
    ];

    public function reference()
    {
        return $this->belongsTo(MfgReference::class, 'referenceId');
    }

    public function sizes()
    {
        return $this->hasMany(MfgSizeGroupSize::class, 'sizeGroupId');
    }

    public function surcharges()
    {
        return $this->hasMany(MfgSizeGroupSurcharge::class, 'sizeGroupId');
    }
}
