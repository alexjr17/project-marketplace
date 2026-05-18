<?php

namespace App\Models;

class ReviewHelpfulVote extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'review_helpful_votes';

    protected $casts = [
        'isHelpful' => 'boolean',
    ];

    public function review()
    {
        return $this->belongsTo(Review::class, 'reviewId');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'userId');
    }
}
