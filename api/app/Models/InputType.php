<?php

namespace App\Models;

class InputType extends BaseModel
{
    protected $table = 'input_types';

    protected $casts = [
        'isActive' => 'boolean',
        'hasVariants' => 'boolean',
    ];

    public function inputs()
    {
        return $this->hasMany(Input::class, 'inputTypeId');
    }

    public function inputTypeSizes()
    {
        return $this->hasMany(InputTypeSize::class, 'inputTypeId');
    }
}
