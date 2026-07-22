<?php

namespace App\Models;

/**
 * Componente de una referencia (parte de la prenda: SUPERIOR / INFERIOR).
 * Sirve para agrupar los materiales por parte.
 */
class MfgReferenceComponent extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'mfg_reference_components';

    public function reference()
    {
        return $this->belongsTo(MfgReference::class, 'referenceId');
    }
}
