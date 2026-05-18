<?php

namespace App\Models;

class Payment extends BaseModel
{
    protected $table = 'payments';

    protected $casts = [
        'verifiedAt' => 'datetime',
        'refundedAt' => 'datetime',
        'initiatedAt' => 'datetime',
        'paidAt' => 'datetime',
        'failedAt' => 'datetime',
        'cancelledAt' => 'datetime',
        'expiredAt' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class, 'orderId');
    }
}
