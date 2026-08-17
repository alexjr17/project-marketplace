<?php

namespace App\Models;

/** Despacho / entrega de producto terminado. */
class MfgDispatch extends BaseModel
{
    protected $table = 'mfg_dispatches';

    protected $casts = [
        'dispatchedAt' => 'datetime',
    ];

    public function client()
    {
        return $this->belongsTo(MfgClient::class, 'clientId');
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(MfgPurchaseOrder::class, 'purchaseOrderId');
    }

    public function warehouse()
    {
        return $this->belongsTo(MfgWarehouse::class, 'warehouseId');
    }

    public function items()
    {
        return $this->hasMany(MfgDispatchItem::class, 'dispatchId');
    }
}
