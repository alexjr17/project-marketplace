<?php

namespace App\Models;

/**
 * Talla disponible para una referencia (pivote hacia el catálogo sizes).
 */
class MfgReferenceSize extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'mfg_reference_sizes';

    public function reference()
    {
        return $this->belongsTo(MfgReference::class, 'referenceId');
    }

    public function size()
    {
        return $this->belongsTo(MfgSize::class, 'sizeId');
    }
}
