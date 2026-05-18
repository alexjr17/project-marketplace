<?php

namespace App\Models;

class InputBatchMovement extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'input_batch_movements';

    public function input()
    {
        return $this->belongsTo(Input::class, 'inputId');
    }

    public function inputBatch()
    {
        return $this->belongsTo(InputBatch::class, 'inputBatchId');
    }
}
