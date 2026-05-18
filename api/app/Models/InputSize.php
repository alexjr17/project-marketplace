<?php

namespace App\Models;

class InputSize extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'input_sizes';

    public function input()
    {
        return $this->belongsTo(Input::class, 'inputId');
    }

    public function size()
    {
        return $this->belongsTo(Size::class, 'sizeId');
    }
}
