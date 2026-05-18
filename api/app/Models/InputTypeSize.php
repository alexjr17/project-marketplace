<?php

namespace App\Models;

class InputTypeSize extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'input_type_sizes';

    public function inputType()
    {
        return $this->belongsTo(InputType::class, 'inputTypeId');
    }

    public function size()
    {
        return $this->belongsTo(Size::class, 'sizeId');
    }
}
