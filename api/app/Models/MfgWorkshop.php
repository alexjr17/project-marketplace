<?php

namespace App\Models;

/**
 * Taller de producción. Puede ser interno o satélite (externo/tercerizado).
 */
class MfgWorkshop extends BaseModel
{
    protected $table = 'mfg_workshops';

    protected $casts = [
        'isActive' => 'boolean',
    ];

    public function processes()
    {
        return $this->belongsToMany(MfgProcess::class, 'mfg_workshop_processes', 'workshopId', 'processId')
            ->orderBy('sequence');
    }
}
