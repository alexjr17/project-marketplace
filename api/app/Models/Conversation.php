<?php

namespace App\Models;

class Conversation extends BaseModel
{
    protected $table = 'conversations';

    protected $casts = [
        'aiEnabled' => 'boolean',
        'unreadCount' => 'integer',
        'lastMessageAt' => 'datetime',
        'metadata' => 'array',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];

    // El token de sesión solo se expone al cliente web cuando se crea la conversación.
    protected $hidden = ['sessionToken'];

    public function channel()
    {
        return $this->belongsTo(Channel::class, 'channelId');
    }

    public function contact()
    {
        return $this->belongsTo(Contact::class, 'contactId');
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigneeUserId');
    }

    public function messages()
    {
        return $this->hasMany(Message::class, 'conversationId');
    }
}
