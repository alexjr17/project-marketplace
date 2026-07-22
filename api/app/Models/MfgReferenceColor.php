<?php

namespace App\Models;

/**
 * Color disponible para una referencia (pivote hacia el catálogo colors).
 */
class MfgReferenceColor extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'mfg_reference_colors';

    public function reference()
    {
        return $this->belongsTo(MfgReference::class, 'referenceId');
    }

    public function color()
    {
        return $this->belongsTo(MfgColor::class, 'colorId');
    }
}
