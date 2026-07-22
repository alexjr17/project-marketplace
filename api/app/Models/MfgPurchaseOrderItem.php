<?php

namespace App\Models;

/** Línea de una orden de pedido: una celda referencia×talla×color con cantidad. */
class MfgPurchaseOrderItem extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'mfg_purchase_order_items';

    protected $casts = [
        'quantity' => 'integer',
    ];

    public function purchaseOrder()
    {
        return $this->belongsTo(MfgPurchaseOrder::class, 'purchaseOrderId');
    }

    public function reference()
    {
        return $this->belongsTo(MfgReference::class, 'referenceId');
    }

    public function color()
    {
        return $this->belongsTo(MfgColor::class, 'colorId');
    }

    public function size()
    {
        return $this->belongsTo(MfgSize::class, 'sizeId');
    }

    public function productionOrder()
    {
        return $this->belongsTo(MfgProductionOrder::class, 'productionOrderId');
    }
}
