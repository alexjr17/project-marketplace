<?php

namespace App\Models;

/**
 * Regla de consumo de un proceso: qué insumo(s) consume, por tipo (categoría)
 * o por insumo específico.
 */
class MfgProcessConsumption extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'mfg_process_consumptions';

    public function inputType()
    {
        return $this->belongsTo(MfgInputType::class, 'inputTypeId');
    }

    public function input()
    {
        return $this->belongsTo(MfgInput::class, 'inputId');
    }
}
