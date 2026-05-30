<?php

namespace App\Models;

class SocialPost extends BaseModel
{
    protected $table = 'social_posts';

    protected $casts = [
        'scheduledAt' => 'datetime',
        'publishedAt' => 'datetime',
        'metadata' => 'array',
        'mediaUrls' => 'array',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];

    public function channel()
    {
        return $this->belongsTo(Channel::class, 'channelId');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'createdByUserId');
    }
}
