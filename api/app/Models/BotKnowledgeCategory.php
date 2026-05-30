<?php

namespace App\Models;

class BotKnowledgeCategory extends BaseModel
{
    protected $table = 'bot_knowledge_categories';

    protected $casts = [
        'isActive' => 'boolean',
        'sortOrder' => 'integer',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];
}
