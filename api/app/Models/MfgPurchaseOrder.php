<?php

namespace App\Models;

/**
 * Orden de pedido (como `OrdenPedido`): un cliente pide varias referencias.
 * Desde el pedido se generan las órdenes de producción.
 */
class MfgPurchaseOrder extends BaseModel
{
    protected $table = 'mfg_purchase_orders';

    public function client()
    {
        return $this->belongsTo(MfgClient::class, 'clientId');
    }

    public function collection()
    {
        return $this->belongsTo(MfgCollection::class, 'collectionId');
    }

    public function items()
    {
        return $this->hasMany(MfgPurchaseOrderItem::class, 'purchaseOrderId');
    }

    public function productionOrders()
    {
        return $this->hasMany(MfgProductionOrder::class, 'purchaseOrderId');
    }
}
