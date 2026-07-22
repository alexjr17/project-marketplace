<?php

namespace App\Models;

/**
 * Insumo / material propio de la app Fábrica (catálogo simple).
 */
class MfgInput extends BaseModel
{
    protected $table = 'mfg_inputs';

    protected $casts = [
        'isActive' => 'boolean',
    ];

    public function inputType()
    {
        return $this->belongsTo(MfgInputType::class, 'inputTypeId');
    }
}
