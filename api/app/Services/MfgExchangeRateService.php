<?php

namespace App\Services;

use App\Models\MfgExchangeRate;
use Illuminate\Support\Facades\DB;

/** Reglas de la tasa de cambio COP→USD de la app Fábrica: siempre queda una sola activa. */
class MfgExchangeRateService
{
    /** Registra una tasa nueva como la activa y desactiva las anteriores. */
    public function store(array $data): MfgExchangeRate
    {
        return DB::transaction(function () use ($data) {
            MfgExchangeRate::where('isActive', true)->update(['isActive' => false]);

            return MfgExchangeRate::create([
                'rate' => $data['rate'],
                'currency' => strtoupper($data['currency'] ?? 'USD'),
                // Fecha local de Colombia: en UTC, de noche ya sería el día siguiente.
                'effectiveDate' => $data['effectiveDate'] ?? now('America/Bogota')->toDateString(),
                'isActive' => true,
            ]);
        });
    }

    /** Elimina una tasa; si era la activa, la más reciente que queda pasa a ser la activa. */
    public function destroy(MfgExchangeRate $rate): void
    {
        DB::transaction(function () use ($rate) {
            $wasActive = $rate->isActive;
            $rate->delete();
            if ($wasActive) {
                MfgExchangeRate::orderByDesc('id')->first()?->update(['isActive' => true]);
            }
        });
    }
}
