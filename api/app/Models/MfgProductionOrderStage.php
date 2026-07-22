<?php

namespace App\Models;

/**
 * Etapa de una orden de producción (máquina de estados del avance).
 */
class MfgProductionOrderStage extends BaseModel
{
    protected $table = 'mfg_production_order_stages';

    protected $casts = [
        'sequence' => 'integer',
        'quantityDone' => 'integer',
        'startedAt' => 'datetime',
        'finishedAt' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(MfgProductionOrder::class, 'productionOrderId');
    }

    public function process()
    {
        return $this->belongsTo(MfgProcess::class, 'processId');
    }

    public function workshop()
    {
        return $this->belongsTo(MfgWorkshop::class, 'workshopId');
    }

    public function cells()
    {
        return $this->hasMany(MfgProductionStageCell::class, 'stageId');
    }

    public function consumptions()
    {
        return $this->hasMany(MfgStageConsumption::class, 'stageId');
    }

    public function stageComponents()
    {
        return $this->hasMany(MfgStageComponent::class, 'stageId');
    }
}
