<?php

use Illuminate\Support\Facades\Route;

/**
 * Índice de la API. La raíz "/" lista los grupos de endpoints disponibles
 * (todos los recursos viven bajo /api). Evita el error 500 por falta de
 * página de inicio y sirve como documentación rápida.
 */
Route::get('/', function () {
    $groups = collect(Route::getRoutes()->getRoutes())
        ->map(fn ($route) => $route->uri())
        ->filter(fn ($uri) => str_starts_with($uri, 'api/'))
        ->map(fn ($uri) => explode('/', $uri)[1] ?? '')
        ->filter()
        ->unique()
        ->sort()
        ->values()
        ->map(fn ($group) => url('/api/'.$group))
        ->all();

    return response()->json([
        'name' => config('app.name', 'Vexa').' API',
        'status' => 'ok',
        'message' => 'API en línea. Todos los recursos están bajo /api.',
        'endpoint_groups' => $groups,
    ]);
});
