<?php

namespace App\Models;

class CashRegister extends BaseModel
{
    protected $table = 'cash_registers';

    protected $casts = [
        'isActive' => 'boolean',
    ];

    public function orders()
    {
        return $this->hasMany(Order::class, 'cashRegisterId');
    }

    public function cashSessions()
    {
        return $this->hasMany(CashSession::class, 'cashRegisterId');
    }
}
