<?php

namespace App\Models;

/**
 * Referencia (modelo de prenda) que se produce en la fábrica.
 * Su ficha técnica se compone de colores, tallas y materiales (BOM).
 */
class MfgReference extends BaseModel
{
    protected $table = 'mfg_references';

    protected $casts = [
        'isActive' => 'boolean',
        'fixedCost' => 'decimal:2',
        'factor' => 'decimal:4',
        'costVariable' => 'decimal:2',
        'costUnit' => 'decimal:2',
        'basePrice' => 'decimal:2',
    ];

    public function garmentType()
    {
        return $this->belongsTo(MfgGarmentType::class, 'garmentTypeId');
    }

    public function brand()
    {
        return $this->belongsTo(MfgBrand::class, 'brandId');
    }

    public function collection()
    {
        return $this->belongsTo(MfgCollection::class, 'collectionId');
    }

    public function components()
    {
        return $this->hasMany(MfgReferenceComponent::class, 'referenceId');
    }

    public function sizeGroups()
    {
        return $this->hasMany(MfgSizeGroup::class, 'referenceId');
    }

    public function colors()
    {
        return $this->hasMany(MfgReferenceColor::class, 'referenceId');
    }

    public function sizes()
    {
        return $this->hasMany(MfgReferenceSize::class, 'referenceId');
    }

    public function materials()
    {
        return $this->hasMany(MfgReferenceMaterial::class, 'referenceId');
    }
}
