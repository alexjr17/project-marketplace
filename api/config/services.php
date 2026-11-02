<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Pasarelas de pago. Respaldo cuando no están configuradas en Ajustes > Pagos
    // (ver App\Services\PaymentGatewayConfig, que es quien las lee).
    'wompi' => [
        'public_key' => env('WOMPI_PUBLIC_KEY', ''),
        'private_key' => env('WOMPI_PRIVATE_KEY', ''),
        'integrity_key' => env('WOMPI_INTEGRITY_KEY', ''),
        'events_secret' => env('WOMPI_EVENTS_SECRET', ''),
    ],

    'mercadopago' => [
        'access_token' => env('MERCADOPAGO_ACCESS_TOKEN', ''),
        'public_key' => env('MERCADOPAGO_PUBLIC_KEY', ''),
    ],

    // Webhooks: si falta el secreto de firma, en producción se RECHAZAN las peticiones.
    // Solo en local/testing se puede permitir explícitamente (para probar sin la pasarela).
    'webhooks' => [
        'allow_unsigned' => (bool) env('WEBHOOKS_ALLOW_UNSIGNED', false),
    ],

];
