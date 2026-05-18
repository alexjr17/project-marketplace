<?php

namespace App\Models;

class CashSession extends BaseModel
{
    protected $table = 'cash_sessions';

    protected $casts = [
        'openedAt' => 'datetime',
        'closedAt' => 'datetime',
    ];

    public function cashRegister()
    {
        return $this->belongsTo(CashRegister::class, 'cashRegisterId');
    }

    public function seller()
    {
        return $this->belongsTo(User::class, 'sellerId');
    }
}
