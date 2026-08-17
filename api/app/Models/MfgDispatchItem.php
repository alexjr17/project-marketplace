<?php

namespace App\Models;

/** Línea de un despacho: una celda referencia×color×talla. */
class MfgDispatchItem extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'mfg_dispatch_items';

    protected $casts = [
        'quantity' => 'integer',
    ];

    public function dispatch()
    {
        return $this->belongsTo(MfgDispatch::class, 'dispatchId');
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
}
