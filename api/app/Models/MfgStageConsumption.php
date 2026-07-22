<?php

namespace App\Models;

/**
 * Consumo de un insumo en una etapa: esperado (BOM × producido) vs real.
 */
class MfgStageConsumption extends BaseModel
{
    protected $table = 'mfg_stage_consumptions';

    protected $casts = [
        'expectedQty' => 'decimal:4',
        'realQty' => 'decimal:4',
        'unitValue' => 'decimal:4',
    ];

    public function input()
    {
        return $this->belongsTo(MfgInput::class, 'inputId');
    }

    public function color()
    {
        return $this->belongsTo(MfgColor::class, 'colorId');
    }
}
