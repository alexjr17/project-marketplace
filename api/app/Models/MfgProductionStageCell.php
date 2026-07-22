<?php

namespace App\Models;

/**
 * Celda de la matriz de una etapa: cantidad completada por color × talla.
 */
class MfgProductionStageCell extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'mfg_production_stage_cells';

    protected $casts = [
        'quantity' => 'integer',
    ];

    public function color()
    {
        return $this->belongsTo(MfgColor::class, 'colorId');
    }

    public function size()
    {
        return $this->belongsTo(MfgSize::class, 'sizeId');
    }
}
