<?php

namespace App\Models;

/**
 * Estación / etapa de producción (Corte, Confección, Terminado…).
 * El campo `sequence` define la ruta de producción por defecto.
 */
class MfgProcess extends BaseModel
{
    protected $table = 'mfg_processes';

    protected $casts = [
        'sequence' => 'integer',
        'isActive' => 'boolean',
    ];

    public function consumptions()
    {
        return $this->hasMany(MfgProcessConsumption::class, 'processId');
    }
}
