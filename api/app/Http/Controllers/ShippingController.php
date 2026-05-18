<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

/**
 * Sincronización de tarifas de envío.
 *
 * Consulta las tarifas de una transportadora por cada zona. Si la
 * transportadora tiene una conexión API configurada, la consulta en vivo;
 * si no, genera tarifas aproximadas (simulador) para que el flujo sea
 * usable sin credenciales. El resultado es una propuesta — el panel la
 * muestra como vista previa y el usuario decide si aplicarla.
 */
class ShippingController extends Controller
{
    use ApiResponse;

    /** POST /api/shipping/sync-rates */
    public function syncRates(Request $request)
    {
        $data = $request->validate([
            'zones' => 'required|array|min:1',
            'zones.*.id' => 'required|string',
            'zones.*.name' => 'required|string',
            'zones.*.cities' => 'nullable|array',
            'apiConfig' => 'nullable|array',
            'origin' => 'nullable|array',
            'packageDefaults' => 'nullable|array',
            'carrierCode' => 'nullable|string',
            'declaredValue' => 'nullable|numeric',
        ]);

        $api = $data['apiConfig'] ?? null;
        $hasApi = $api && ! empty($api['quoteUrl']);
        $declared = (float) ($data['declaredValue'] ?? 50000);
        $origin = $data['origin'] ?? [];
        $package = $data['packageDefaults'] ?? [];
        $carrierCode = (string) ($data['carrierCode'] ?? '');

        $rates = [];
        $errors = [];
        $usedApi = false;

        foreach ($data['zones'] as $zone) {
            $city = $zone['cities'][0] ?? $zone['name'];
            $result = null;

            if ($hasApi) {
                try {
                    $result = $this->callCarrierApi($api, $origin, $zone, $city, $package, $declared, $carrierCode);
                    $usedApi = true;
                } catch (\Throwable $e) {
                    $errors[] = $zone['name'].': '.$e->getMessage();
                }
            }

            if ($result === null) {
                $result = $this->simulateRate($zone['name']);
            }

            $rates[] = [
                'zoneId' => $zone['id'],
                'baseCost' => $result['baseCost'],
                'costPerKg' => $result['costPerKg'],
                'estimatedDays' => $result['estimatedDays'],
            ];
        }

        return $this->success([
            'source' => $usedApi ? ($errors ? 'mixed' : 'api') : 'simulated',
            'rates' => $rates,
            'errors' => $errors,
            'syncedAt' => now()->toIso8601String(),
        ]);
    }

    /**
     * Cotiza una zona con la transportadora. El tamaño y el peso del paquete
     * vienen de la configuración (no están fijos en el código).
     */
    private function callCarrierApi(array $api, array $origin, array $zone, string $city, array $package, float $declared, string $carrierCode = ''): array
    {
        // Resuelve ciudad → código postal (6 dígitos) y código de departamento.
        $token = $api['auth']['keyValue'] ?? '';
        $originGeo = $this->geocode($origin['city'] ?? '', $token);
        $destGeo = $this->geocode($city, $token);

        // Variables comunes; el TAMAÑO del paquete viene de la configuración.
        $baseVars = [
            'origin.city' => $origin['city'] ?? '',
            'origin.department' => $origin['state'] ?? '',
            'origin.stateCode' => ($originGeo['stateCode'] ?? '') ?: $this->deptCode($origin['state'] ?? ''),
            'origin.postalCode' => ($originGeo['zip'] ?? '') ?: ($origin['postalCode'] ?? ''),
            'origin.dane' => $originGeo['dane'] ?? '',
            'destination.city' => $city,
            'destination.department' => $zone['name'] ?? '',
            'destination.stateCode' => ($destGeo['stateCode'] ?? '') ?: $this->deptCode($zone['name'] ?? ''),
            'destination.postalCode' => $destGeo['zip'] ?? '',
            'destination.dane' => $destGeo['dane'] ?? '',
            'carrier' => $carrierCode,
            'declaredValue' => $declared,
            'length' => (float) ($package['defaultLength'] ?? 30),
            'width' => (float) ($package['defaultWidth'] ?? 25),
            'height' => (float) ($package['defaultHeight'] ?? 5),
            'units' => 1,
        ];

        // Cotiza con el peso configurado (mínimo 1 kg como referencia).
        $weight = max(1.0, (float) ($package['defaultWeightPerItem'] ?? 1));
        [$cost, $days] = $this->quoteCarrier($api, ['weight' => $weight] + $baseVars);

        return [
            'baseCost' => (int) round($cost),
            'costPerKg' => (int) round($cost * 0.15),
            'estimatedDays' => ['min' => $days, 'max' => $days + 2],
        ];
    }

    /**
     * Ejecuta UNA cotización con la transportadora. Devuelve [costo, días].
     */
    private function quoteCarrier(array $api, array $vars): array
    {
        $body = $this->applyTemplate($api['requestTemplate'] ?? '{}', $vars);
        $payload = json_decode($body, true) ?? [];

        // Fuerza el código de la transportadora configurada: así cada
        // transportadora cotiza con el suyo, aunque la plantilla tenga otro.
        $carrierCode = (string) ($vars['carrier'] ?? '');
        if ($carrierCode !== '' && isset($payload['shipment']) && is_array($payload['shipment'])) {
            $payload['shipment']['carrier'] = $carrierCode;
        }

        // Fuerza el código DANE de 8 dígitos en city/postalCode: es el formato
        // que aceptan las transportadoras colombianas vía Envía (servientrega,
        // coordinadora, interrapidísimo, tcc).
        $oDane = (string) ($vars['origin.dane'] ?? '');
        $dDane = (string) ($vars['destination.dane'] ?? '');
        if ($oDane !== '' && isset($payload['origin']) && is_array($payload['origin'])) {
            $payload['origin']['city'] = $oDane;
            $payload['origin']['postalCode'] = $oDane;
        }
        if ($dDane !== '' && isset($payload['destination']) && is_array($payload['destination'])) {
            $payload['destination']['city'] = $dDane;
            $payload['destination']['postalCode'] = $dDane;
        }

        $headers = $api['headers'] ?? [];
        $query = [];

        $auth = $api['auth'] ?? ['type' => 'none'];
        switch ($auth['type'] ?? 'none') {
            case 'apiKey':
                if (($auth['keyLocation'] ?? 'header') === 'header') {
                    $headers[$auth['keyName'] ?: 'Authorization'] = $auth['keyValue'] ?? '';
                } else {
                    $query[$auth['keyName'] ?: 'token'] = $auth['keyValue'] ?? '';
                }
                break;
            case 'bearer':
                $headers['Authorization'] = 'Bearer '.($auth['keyValue'] ?? '');
                break;
        }

        $http = Http::timeout(((int) ($api['timeoutMs'] ?? 8000)) / 1000)->withHeaders($headers);
        if (($auth['type'] ?? '') === 'basic') {
            $http = $http->withBasicAuth($auth['username'] ?? '', $auth['password'] ?? '');
        }

        $method = strtoupper($api['method'] ?? 'POST');
        if ($method === 'GET') {
            $response = $http->get($api['quoteUrl'], array_merge($query, $payload));
        } else {
            $url = $api['quoteUrl'].($query ? '?'.http_build_query($query) : '');
            $response = $http->post($url, $payload);
        }

        if (! $response->successful()) {
            throw new \RuntimeException('HTTP '.$response->status());
        }
        // Si la respuesta es una página web (HTML), la URL no es una API.
        if (str_starts_with(ltrim($response->body()), '<')) {
            throw new \RuntimeException('la URL devolvió una página web (HTML), no datos de API — revisa que sea el endpoint de cotización, no la documentación');
        }

        $json = $response->json() ?? [];
        $mapping = $api['responseMapping'] ?? [];

        $cost = $this->dotGet($json, $mapping['costPath'] ?? '');
        if ($cost === null || $cost === '') {
            $err = ! empty($mapping['errorPath']) ? $this->dotGet($json, $mapping['errorPath']) : null;
            if (is_string($err) && $err !== '') {
                throw new \RuntimeException($err);
            }
            // Sin costo: mostrar estado HTTP y cuerpo crudo para diagnosticar.
            $raw = trim($response->body());
            $raw = $raw === '' ? '(cuerpo vacío)' : mb_substr($raw, 0, 500);
            throw new \RuntimeException('sin costo — HTTP '.$response->status().', cuerpo: '.$raw);
        }
        if (! empty($mapping['costIsString'])) {
            $cost = (float) preg_replace('/[^0-9]/', '', (string) $cost);
        }

        $days = ! empty($mapping['daysPath']) ? (int) $this->dotGet($json, $mapping['daysPath']) : 3;

        return [(float) $cost, max(1, $days)];
    }

    /**
     * Resuelve una ciudad colombiana a su código postal (6 dígitos) y código
     * de departamento (3 letras) usando la API de geocodes de Envía.
     * Devuelve [] si no se puede resolver.
     */
    private function geocode(string $city, string $token): array
    {
        if (trim($city) === '' || trim($token) === '') {
            return [];
        }

        try {
            $resp = Http::timeout(8)->withToken($token)
                ->get('https://geocodes.envia.com/locate/CO/'.rawurlencode($city));
            if (! $resp->successful()) {
                return [];
            }
            $json = $resp->json();
            $first = is_array($json) ? ($json[0] ?? null) : null;
            if (! is_array($first)) {
                return [];
            }

            return [
                'zip' => (string) ($first['zip_codes'][0]['zip_code'] ?? ''),
                'dane' => (string) ($first['zip_codes'][0]['info']['stat_8digit'] ?? ''),
                'stateCode' => (string) ($first['state']['code']['3digit'] ?? ''),
            ];
        } catch (\Throwable) {
            return [];
        }
    }

    /** Código ISO 3166-2 (3 letras) de un departamento de Colombia. */
    private function deptCode(string $name): string
    {
        $key = strtr(mb_strtolower(trim($name)), [
            'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ñ' => 'n',
        ]);

        $map = [
            'amazonas' => 'AMA', 'antioquia' => 'ANT', 'arauca' => 'ARA', 'atlantico' => 'ATL',
            'bogota' => 'DC', 'bogota d.c.' => 'DC', 'bolivar' => 'BOL', 'boyaca' => 'BOY',
            'caldas' => 'CAL', 'caqueta' => 'CAQ', 'casanare' => 'CAS', 'cauca' => 'CAU',
            'cesar' => 'CES', 'choco' => 'CHO', 'cordoba' => 'COR', 'cundinamarca' => 'CUN',
            'guainia' => 'GUA', 'guaviare' => 'GUV', 'huila' => 'HUI', 'la guajira' => 'LAG',
            'magdalena' => 'MAG', 'meta' => 'MET', 'narino' => 'NAR', 'norte de santander' => 'NSA',
            'putumayo' => 'PUT', 'quindio' => 'QUI', 'risaralda' => 'RIS',
            'san andres y providencia' => 'SAP', 'santander' => 'SAN', 'sucre' => 'SUC',
            'tolima' => 'TOL', 'valle del cauca' => 'VAC', 'vaupes' => 'VAU', 'vichada' => 'VID',
        ];

        return $map[$key] ?? $name;
    }

    /**
     * Reemplaza {{variables}} en una plantilla JSON.
     * Las variables numéricas (peso, valor declarado, dimensiones) se insertan
     * SIN comillas aunque en la plantilla aparezcan como "{{var}}", para que el
     * JSON resultante las tenga como números (las APIs suelen exigirlo).
     */
    private function applyTemplate(string $tpl, array $vars): string
    {
        $numeric = ['weight', 'declaredValue', 'length', 'width', 'height', 'units'];

        // "{{var}}" entrecomillada → número sin comillas si la variable es numérica.
        $tpl = preg_replace_callback('/"\{\{\s*([\w.]+)\s*\}\}"/', function ($m) use ($vars, $numeric) {
            $name = $m[1];
            $value = $vars[$name] ?? '';
            if (in_array($name, $numeric, true)) {
                return is_numeric($value) ? (string) (0 + $value) : '0';
            }

            return json_encode((string) $value, JSON_UNESCAPED_UNICODE) ?: '""';
        }, $tpl) ?? $tpl;

        // {{var}} suelta → su valor en texto.
        return preg_replace_callback('/\{\{\s*([\w.]+)\s*\}\}/', function ($m) use ($vars) {
            return (string) ($vars[$m[1]] ?? '');
        }, $tpl) ?? $tpl;
    }

    /** Lee un valor anidado por dot-path: "data.0.valor". */
    private function dotGet(array $data, string $path)
    {
        if ($path === '') {
            return null;
        }
        $cur = $data;
        foreach (explode('.', $path) as $key) {
            if (is_array($cur) && array_key_exists($key, $cur)) {
                $cur = $cur[$key];
            } else {
                return null;
            }
        }

        return $cur;
    }

    /**
     * Tarifa aproximada cuando no hay conexión API. Determinística por zona
     * con una pequeña variación para reflejar cambios de mercado.
     */
    private function simulateRate(string $zoneName): array
    {
        $seed = crc32($zoneName);
        $base = 7000 + ($seed % 19) * 1000 + random_int(-800, 1800);
        $perKg = 1500 + ($seed % 6) * 500 + random_int(-200, 600);
        $minDays = 1 + ($seed % 4);

        return [
            'baseCost' => max(5000, (int) round($base / 100) * 100),
            'costPerKg' => max(1000, (int) round($perKg / 100) * 100),
            'estimatedDays' => ['min' => $minDays, 'max' => $minDays + 2 + ($seed % 3)],
        ];
    }
}
