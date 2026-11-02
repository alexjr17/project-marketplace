<?php

namespace App\Models;

/**
 * Serie de consecutivos (tabla number_sequences). Solo la usa NumberSequenceService.
 */
class NumberSequence extends BaseModel
{
    protected $table = 'number_sequences';

    protected $casts = [
        'lastValue' => 'integer',
    ];
}
