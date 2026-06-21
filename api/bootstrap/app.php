<?php

use App\Http\Middleware\CheckPermission;
use App\Http\Middleware\ForceJsonResponse;
use App\Http\Middleware\OptionalAuth;
use App\Http\Middleware\RequireAdmin;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Detrás del proxy de Render: respeta X-Forwarded-* para que las URLs
        // generadas (imágenes, etc.) salgan en https.
        $middleware->trustProxies(at: '*');

        // Todas las rutas /api/* responden siempre en JSON.
        $middleware->api(prepend: [
            ForceJsonResponse::class,
        ]);

        // Alias de middleware para proteger rutas.
        $middleware->alias([
            'permission' => CheckPermission::class,
            'admin' => RequireAdmin::class,
            'auth.optional' => OptionalAuth::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Formato de error unificado para la API: { success:false, message, errors? }
        // Replica el contrato que esperaba el frontend con la API Node.
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null; // Páginas web: manejo por defecto de Laravel.
            }

            $debug = (bool) config('app.debug');

            // Validación → 422
            if ($e instanceof ValidationException) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $e->errors(),
                ], 422);
            }

            // No autenticado → 401 (dispara el cierre de sesión en el frontend)
            if ($e instanceof AuthenticationException) {
                return response()->json([
                    'success' => false,
                    'message' => 'No autenticado. Por favor, inicia sesión nuevamente.',
                ], 401);
            }

            // Sin permisos → 403
            if ($e instanceof AuthorizationException) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage() ?: 'No tienes permiso para realizar esta acción.',
                ], 403);
            }

            // Modelo no encontrado → 404
            if ($e instanceof ModelNotFoundException) {
                return response()->json([
                    'success' => false,
                    'message' => 'Recurso no encontrado.',
                ], 404);
            }

            // Excepciones HTTP (404, 405, 429, etc.)
            if ($e instanceof HttpExceptionInterface) {
                $status = $e->getStatusCode();
                $message = $e->getMessage() ?: match ($status) {
                    404 => 'Recurso no encontrado.',
                    403 => 'No tienes permiso para realizar esta acción.',
                    405 => 'Método no permitido.',
                    429 => 'Demasiadas solicitudes. Intenta más tarde.',
                    default => 'Error en la solicitud.',
                };

                return response()->json(array_filter([
                    'success' => false,
                    'message' => $message,
                    'stack' => $debug ? $e->getTraceAsString() : null,
                ], fn ($v) => $v !== null), $status);
            }

            // Error desconocido → 500
            return response()->json(array_filter([
                'success' => false,
                'message' => $debug ? $e->getMessage() : 'Error interno del servidor.',
                'stack' => $debug ? $e->getTraceAsString() : null,
            ], fn ($v) => $v !== null), 500);
        });
    })->create();
