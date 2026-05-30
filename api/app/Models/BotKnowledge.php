<?php

namespace App\Models;

class BotKnowledge extends BaseModel
{
    protected $table = 'bot_knowledge';

    protected $casts = [
        'isActive' => 'boolean',
        'sortOrder' => 'integer',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];
}
