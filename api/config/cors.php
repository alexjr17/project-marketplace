<?php

/*
|--------------------------------------------------------------------------
| Configuración de CORS
|--------------------------------------------------------------------------
| Permite que el frontend React (otro origen) consuma esta API.
| Los orígenes permitidos se definen en .env -> CORS_ALLOWED_ORIGINS
| (separados por comas).
*/

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173'))
    ))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // El frontend envía el token en la cabecera Authorization, no por cookies.
    'supports_credentials' => false,

];
