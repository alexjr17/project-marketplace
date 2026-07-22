<?php

namespace App\Models;

/**
 * Sustitución de un insumo por otro en una orden de producción.
 */
class MfgOrderInputSubstitution extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'mfg_order_input_substitutions';

    public function originalInput()
    {
        return $this->belongsTo(MfgInput::class, 'originalInputId');
    }

    public function substituteInput()
    {
        return $this->belongsTo(MfgInput::class, 'substituteInputId');
    }

    public function color()
    {
        return $this->belongsTo(MfgColor::class, 'colorId');
    }
}
