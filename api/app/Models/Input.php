<?php

namespace App\Models;

class Input extends BaseModel
{
    protected $table = 'inputs';

    protected $casts = [
        'isActive' => 'boolean',
    ];

    public function inputType()
    {
        return $this->belongsTo(InputType::class, 'inputTypeId');
    }

    public function batches()
    {
        return $this->hasMany(InputBatch::class, 'inputId');
    }

    public function movements()
    {
        return $this->hasMany(InputBatchMovement::class, 'inputId');
    }

    public function inputColors()
    {
        return $this->hasMany(InputColor::class, 'inputId');
    }

    public function inputSizes()
    {
        return $this->hasMany(InputSize::class, 'inputId');
    }

    public function variants()
    {
        return $this->hasMany(InputVariant::class, 'inputId');
    }

    public function productInputs()
    {
        return $this->hasMany(ProductInput::class, 'inputId');
    }

    public function zoneInputs()
    {
        return $this->hasMany(ZoneInput::class, 'inputId');
    }
}
