<?php

namespace App\Services;

use App\Models\Setting;
use Throwable;
use Illuminate\Support\Facades\Log;

/**
 * Única fuente de las credenciales de las pasarelas (Wompi, Mercado Pago).
 *
 * Lee lo que el admin guarda en Ajustes > Pagos (`payment_settings.methods[]`) y, si
 * falta, usa las variables de entorno (config/services.php). También decide qué parte
 * de `payment_settings` es pública: las claves secretas NUNCA salen en /settings/public.
 */
class PaymentGatewayConfig
{
    /** Campos de configuración de pasarela que se pueden mostrar al público. */
    private const PUBLIC_GATEWAY_FIELDS = ['publicKey', 'isTestMode'];

    /** Configuraciones de pasarela dentro de cada método, con datos secretos. */
    private const GATEWAY_CONFIG_KEYS = ['wompiConfig', 'mercadoPagoConfig'];

    /** Configuración del método de pago de un tipo (wompi, mercadopago…), o []. */
    private function methodConfig(string $type, string $configKey): array
    {
        try {
            $value = Setting::where('key', 'payment_settings')->value('value');
            $methods = is_array($value['methods'] ?? null) ? $value['methods'] : [];
            foreach ($methods as $m) {
                if (($m['type'] ?? '') === $type) {
                    return is_array($m[$configKey] ?? null) ? $m[$configKey] : [];
                }
            }
        } catch (Throwable $e) {
            Log::error("PaymentGatewayConfig {$type}: ".$e->getMessage());
        }

        return [];
    }

    /** @return array{publicKey:string, privateKey:string, integrityKey:string, eventsSecret:string, isTestMode:bool} */
    public function wompi(): array
    {
        $cfg = $this->methodConfig('wompi', 'wompiConfig');
        $env = config('services.wompi');
        $publicKey = (string) (($cfg['publicKey'] ?? '') ?: ($env['public_key'] ?? ''));

        return [
            'publicKey' => $publicKey,
            'privateKey' => (string) (($cfg['privateKey'] ?? '') ?: ($env['private_key'] ?? '')),
            'integrityKey' => (string) (($cfg['integrityKey'] ?? '') ?: ($env['integrity_key'] ?? '')),
            'eventsSecret' => (string) (($cfg['eventSecret'] ?? '') ?: ($env['events_secret'] ?? '')),
            'isTestMode' => $publicKey === '' || str_starts_with($publicKey, 'pub_test_'),
        ];
    }

    /** @return array{accessToken:string, publicKey:string} */
    public function mercadoPago(): array
    {
        $cfg = $this->methodConfig('mercadopago', 'mercadoPagoConfig');
        $env = config('services.mercadopago');

        return [
            'accessToken' => (string) (($cfg['accessToken'] ?? '') ?: ($env['access_token'] ?? '')),
            'publicKey' => (string) (($cfg['publicKey'] ?? '') ?: ($env['public_key'] ?? '')),
        ];
    }

    /**
     * Versión pública de `payment_settings`: deja los métodos y sus datos para el cliente
     * (cuentas bancarias, Nequi, punto físico…) pero de las pasarelas solo la llave pública.
     */
    public static function publicView(array $paymentSettings): array
    {
        if (! is_array($paymentSettings['methods'] ?? null)) {
            return $paymentSettings;
        }

        $paymentSettings['methods'] = array_map(function ($method) {
            if (! is_array($method)) {
                return $method;
            }
            foreach (self::GATEWAY_CONFIG_KEYS as $key) {
                if (is_array($method[$key] ?? null)) {
                    $method[$key] = array_intersect_key($method[$key], array_flip(self::PUBLIC_GATEWAY_FIELDS));
                }
            }

            return $method;
        }, $paymentSettings['methods']);

        return $paymentSettings;
    }
}
