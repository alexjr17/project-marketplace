<?php

namespace App\Models;

/** Cliente de la app Fábrica (catálogo propio). */
class MfgClient extends BaseModel
{
    protected $table = 'mfg_clients';

    protected $casts = [
        'isActive' => 'boolean',
    ];

    public function purchaseOrders()
    {
        return $this->hasMany(MfgPurchaseOrder::class, 'clientId');
    }
}
