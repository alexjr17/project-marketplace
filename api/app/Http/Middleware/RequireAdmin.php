<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restringe la ruta al SuperAdmin (rol id 1).
 * Equivale al requireAdmin del backend Node.
 */
class RequireAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            abort(401, 'No autenticado. Por favor, inicia sesión nuevamente.');
        }

        if ((int) $user->roleId !== 1) {
            abort(403, 'Se requieren permisos de administrador');
        }

        return $next($request);
    }
}
