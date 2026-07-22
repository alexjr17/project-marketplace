<?php

namespace App\Models;

/**
 * Tipo de insumo de la app Fábrica. Clasifica si el insumo es un material
 * (PRODUCTO, se consume) o un servicio / mano de obra (SERVICIO, no se consume).
 */
class MfgInputType extends BaseModel
{
    protected $table = 'mfg_input_types';

    protected $casts = [
        'isActive' => 'boolean',
        'consumesByColor' => 'boolean',
    ];
}
