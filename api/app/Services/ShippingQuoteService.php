<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Str;

/**
 * Cotización del envío por zona y transportadora: el MISMO algoritmo que
 * web/src/utils/shippingQuote.ts, para que lo que el checkout muestra sea lo que se cobra.
 * La zona se ubica por el departamento de la ciudad (resources/data/colombia_geo.json, la
 * misma lista que web/src/data/colombiaGeo.ts) y, si no, por la lista de ciudades de la zona.
 */
class ShippingQuoteService
{
    private ?array $geo = null;

    private static function norm(?string $s): string
    {
        return Str::ascii(mb_strtolower(trim((string) $s)));
    }

    private function departmentOfCity(string $cityN): ?string
    {
        $this->geo ??= json_decode((string) file_get_contents(resource_path('data/colombia_geo.json')), true) ?: [];
        foreach ($this->geo as $d) {
            foreach ($d['cities'] ?? [] as $c) {
                if (self::norm($c) === $cityN) {
                    return $d['department'];
                }
            }
        }

        return null;
    }

    /** Ajustes de envío guardados (shipping_settings). */
    public function settings(): array
    {
        $value = Setting::where('key', 'shipping_settings')->first()?->value;

        return is_array($value) ? $value : [];
    }

    /** Peso estimado del paquete: peso por ítem configurado × cantidad de ítems. */
    public function packageWeight(array $shipping, int $totalItems): float
    {
        $perItem = (float) ($shipping['packageDefaults']['defaultWeightPerItem'] ?? 0.5);

        return $perItem * max(1, $totalItems);
    }

    /**
     * Costo del envío a $city, o null si no se puede cotizar (sin zona, transportadora o
     * tarifa); en ese caso el pedido usa la tarifa fija de respaldo.
     */
    public function quote(array $shipping, string $city, float $totalWeightKg, float $subtotal): ?int
    {
        if (trim($city) === '') {
            return null;
        }
        $cityN = self::norm($city);
        $zones = array_values(array_filter($shipping['zones'] ?? [], fn ($z) => ! empty($z['isActive'])));

        $zone = null;
        $dept = $this->departmentOfCity($cityN);
        if ($dept !== null) {
            foreach ($zones as $z) {
                if (! empty($z['department']) && self::norm($z['department']) === self::norm($dept)) {
                    $zone = $z;
                    break;
                }
            }
        }
        if ($zone === null) {
            foreach ($zones as $z) {
                foreach ($z['cities'] ?? [] as $c) {
                    if (self::norm($c) === $cityN) {
                        $zone = $z;
                        break 2;
                    }
                }
            }
        }
        if ($zone === null) {
            return null;
        }

        $carriers = array_values(array_filter($shipping['carriers'] ?? [], fn ($c) => ! empty($c['isActive'])));
        $carrier = null;
        foreach ($carriers as $c) {
            if (($c['id'] ?? null) === ($shipping['defaultCarrierId'] ?? null)) {
                $carrier = $c;
                break;
            }
        }
        $carrier ??= $carriers[0] ?? null;
        if ($carrier === null) {
            return null;
        }

        $rate = null;
        foreach ($carrier['zoneRates'] ?? [] as $r) {
            if (($r['zoneId'] ?? null) === ($zone['id'] ?? null)) {
                $rate = $r;
                break;
            }
        }
        if ($rate === null) {
            return null;
        }

        $threshold = $rate['freeShippingThreshold'] ?? null;
        if ($threshold !== null && $subtotal >= (float) $threshold) {
            return 0;
        }
        $weight = max($totalWeightKg, 0.1);

        return (int) round((float) ($rate['baseCost'] ?? 0) + $weight * (float) ($rate['costPerKg'] ?? 0));
    }
}
