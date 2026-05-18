<?php

namespace App\Models;

class InputBatch extends BaseModel
{
    protected $table = 'input_batches';

    protected $casts = [
        'isActive' => 'boolean',
        'purchaseDate' => 'datetime',
        'expiryDate' => 'datetime',
    ];

    public function input()
    {
        return $this->belongsTo(Input::class, 'inputId');
    }

    public function movements()
    {
        return $this->hasMany(InputBatchMovement::class, 'inputBatchId');
    }
}
