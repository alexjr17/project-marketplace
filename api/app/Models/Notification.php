<?php

namespace App\Models;

class Notification extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'notifications';

    protected $casts = [
        'isRead' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'userId');
    }
}
