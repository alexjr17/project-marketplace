<?php

namespace App\Models;

class POSCustomer extends BaseModel
{
    protected $table = 'pos_customers';

    public function orders()
    {
        return $this->hasMany(Order::class, 'posCustomerId');
    }
}
