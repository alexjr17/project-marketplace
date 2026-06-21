<?php

namespace App\Models;

class Announcement extends BaseModel
{
    protected $table = 'announcements';

    protected $casts = [
        'isActive' => 'boolean',
        'dismissible' => 'boolean',
        'priority' => 'integer',
        'startsAt' => 'datetime',
        'endsAt' => 'datetime',
    ];
}
