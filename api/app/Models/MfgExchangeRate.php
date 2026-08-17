<?php

namespace App\Models;

/** Tasa de cambio COP→USD de la app Fábrica. */
class MfgExchangeRate extends BaseModel
{
    const UPDATED_AT = null;

    protected $table = 'mfg_exchange_rates';

    protected $casts = [
        'rate' => 'decimal:4',
        'isActive' => 'boolean',
        'effectiveDate' => 'date',
    ];

    /** Tasa activa (la más reciente marcada activa), o null. */
    public static function active(): ?self
    {
        return self::where('isActive', true)->orderByDesc('id')->first();
    }
}
