<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;

/**
 * Regla común de los webhooks entrantes (Wompi, Mercado Pago, Messenger, WhatsApp).
 * Si la pasarela no tiene configurado su secreto de firma, la petición se RECHAZA:
 * antes se aceptaba y cualquiera podía marcar un pedido como pagado o inyectar mensajes.
 * Solo fuera de producción, y con WEBHOOKS_ALLOW_UNSIGNED=true, se permiten sin firma.
 */
final class WebhookGuard
{
    public static function allowUnsigned(string $source): bool
    {
        $allowed = ! app()->environment('production') && (bool) config('services.webhooks.allow_unsigned');
        if (! $allowed) {
            Log::warning("Webhook {$source} rechazado: falta el secreto de firma.");
        }

        return $allowed;
    }

    /** Comparación de firmas en tiempo constante. */
    public static function equals(string $expected, ?string $given): bool
    {
        return $given !== null && $given !== '' && hash_equals($expected, $given);
    }
}
