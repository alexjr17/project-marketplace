<?php

namespace App\Models;

/** Lote / compra de un insumo con su precio (para costear la ficha técnica). */
class MfgInputBatch extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'mfg_input_batches';

    protected $casts = [
        'unitCost' => 'decimal:2',
        'quantity' => 'decimal:4',
        'purchasedAt' => 'date',
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
