<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rutas de la API
|--------------------------------------------------------------------------
| Todas las rutas tienen el prefijo /api. Cada módulo vive en routes/api/<módulo>.php
| con sus prefijos y middlewares (auth:sanctum, permission:…, throttle:…).
| Ojo con el orden DENTRO de un mismo prefijo: las rutas fijas (p. ej. 'stats') van
| antes de las de parámetro ('{id}'). tests/Feature/Contracts/RouteSnapshotTest.php
| guarda la foto de todas las rutas y sus middlewares.
*/

// Verificación de estado del servidor.
Route::get('/health', function () {
    return response()->json([
        'success' => true,
        'message' => 'API funcionando correctamente',
        'timestamp' => now()->toIso8601String(),
        'environment' => app()->environment(),
    ]);
});

foreach ([
    'auth',             // login, registro, contraseña, perfil propio
    'users-roles',      // usuarios, direcciones, roles y permisos
    'catalog',          // tallas, colores, categorías, tipos de producto, imágenes servidas
    'promotions',       // anuncios y cupones
    'products',         // productos, variantes, reseñas, códigos de barras
    'orders-payments',  // carrito, pedidos, pagos, envíos
    'webhooks',         // Wompi, Mercado Pago, Messenger, WhatsApp
    'inventory',        // tipos de insumo, insumos, lotes, movimientos, conteos, conversiones
    'customizer',       // plantillas, zonas, recetas, tipos de zona, imágenes de diseño
    'settings',         // configuración, subida de imágenes, plantillas de etiquetas
    'purchasing',       // órdenes de compra, devoluciones, proveedores
    'pos-cash',         // cajas registradoras y punto de venta
    'messaging',        // notificaciones, bandeja de mensajería, chat web
    'manufacturing',    // app Fábrica
] as $module) {
    require __DIR__."/api/{$module}.php";
}

// Rutas de depuración opcionales (archivo ignorado por git; solo en local).
if (file_exists(__DIR__.'/debug-ai.php')) {
    require __DIR__.'/debug-ai.php';
}
