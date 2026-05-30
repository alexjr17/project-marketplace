<?php

namespace App\Models;

class Channel extends BaseModel
{
    protected $table = 'channels';

    protected $casts = [
        'isActive' => 'boolean',
        'aiAutoReply' => 'boolean',
        'config' => 'array',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];

    public function conversations()
    {
        return $this->hasMany(Conversation::class, 'channelId');
    }
}
