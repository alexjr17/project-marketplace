<?php

namespace App\Models;

/**
 * Material de la ficha técnica (BOM) de una referencia: un insumo y su
 * consumo por unidad producida (opcionalmente por color).
 */
class MfgReferenceMaterial extends BaseModel
{
    protected $table = 'mfg_reference_materials';

    protected $casts = [
        'consumptionInitial' => 'decimal:4',
        'increment' => 'decimal:2',
        'consumption' => 'decimal:4',
        'unitValue' => 'decimal:4',
    ];

    public function reference()
    {
        return $this->belongsTo(MfgReference::class, 'referenceId');
    }

    public function input()
    {
        return $this->belongsTo(MfgInput::class, 'inputId');
    }

    public function component()
    {
        return $this->belongsTo(MfgReferenceComponent::class, 'componentId');
    }

    public function color()
    {
        return $this->belongsTo(MfgColor::class, 'colorId');
    }
}
