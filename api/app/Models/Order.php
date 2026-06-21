<?php

namespace App\Models;

class Order extends BaseModel
{
    protected $table = 'orders';

    protected $casts = [
        'shipping' => 'array',
        'statusHistory' => 'array',
        'editHistory' => 'array',
        'paidAt' => 'datetime',
        'shippedAt' => 'datetime',
        'deliveredAt' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'userId');
    }

    public function posCustomer()
    {
        return $this->belongsTo(POSCustomer::class, 'posCustomerId');
    }

    public function seller()
    {
        return $this->belongsTo(User::class, 'sellerId');
    }

    public function cashRegister()
    {
        return $this->belongsTo(CashRegister::class, 'cashRegisterId');
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class, 'orderId');
    }

    public function payments()
    {
        return $this->hasMany(Payment::class, 'orderId');
    }
}
