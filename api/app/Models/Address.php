<?php

namespace App\Models;

class Address extends BaseModel
{
    protected $table = 'addresses';

    protected $casts = [
        'isDefault' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'userId');
    }
}
