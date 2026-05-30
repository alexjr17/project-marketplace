<?php

namespace App\Models;

class Contact extends BaseModel
{
    protected $table = 'contacts';

    protected $casts = [
        'externalIds' => 'array',
        'metadata' => 'array',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'userId');
    }

    public function conversations()
    {
        return $this->hasMany(Conversation::class, 'contactId');
    }
}
