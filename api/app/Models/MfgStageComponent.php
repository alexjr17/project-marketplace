<?php

namespace App\Models;

/**
 * Taller asignado a un componente de la prenda dentro de una etapa externa
 * (como `EtapaComponente` de project-fabrica-ropa). Permite mandar cada
 * componente (SUPERIOR/INFERIOR) a un taller satélite distinto.
 */
class MfgStageComponent extends BaseModel
{
    public $timestamps = false;

    protected $table = 'mfg_stage_components';

    public function stage()
    {
        return $this->belongsTo(MfgProductionOrderStage::class, 'stageId');
    }

    public function component()
    {
        return $this->belongsTo(MfgReferenceComponent::class, 'componentId');
    }

    public function workshop()
    {
        return $this->belongsTo(MfgWorkshop::class, 'workshopId');
    }
}
