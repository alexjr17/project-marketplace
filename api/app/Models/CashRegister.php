<?php

namespace App\Models;

class CashRegister extends BaseModel
{
    protected $table = 'cash_registers';

    protected $casts = [
        'isActive' => 'boolean',
        // Categorías que la caja puede vender. Vacío/null = todas.
        'categoryIds' => 'array',
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
