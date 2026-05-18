<?php

namespace App\Models;

class InputColor extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'input_colors';

    public function input()
    {
        return $this->belongsTo(Input::class, 'inputId');
    }

    public function color()
    {
        return $this->belongsTo(Color::class, 'colorId');
    }
}
