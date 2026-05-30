<?php

namespace App\Models;

class Message extends BaseModel
{
    protected $table = 'messages';

    protected $casts = [
        'attachments' => 'array',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];

    public function conversation()
    {
        return $this->belongsTo(Conversation::class, 'conversationId');
    }

    public function senderUser()
    {
        return $this->belongsTo(User::class, 'senderUserId');
    }
}
