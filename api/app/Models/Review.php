<?php

namespace App\Models;

class Review extends BaseModel
{
    protected $table = 'reviews';

    protected $casts = [
        'verifiedPurchase' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'userId');
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'productId');
    }

    public function helpfulVotes()
    {
        return $this->hasMany(ReviewHelpfulVote::class, 'reviewId');
    }
}
