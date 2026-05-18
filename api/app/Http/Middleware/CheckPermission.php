<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Verifica que el usuario autenticado tenga al menos uno de los permisos.
 * Uso en rutas:
 *   ->middleware('permission:products.create')          (un permiso)
 *   ->middleware('permission:products.view,pos.access') (cualquiera de ellos)
 *
 * El rol con id 1 (SuperAdmin) siempre tiene acceso total.
 */
class CheckPermission
{
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        if (! $user) {
            abort(401, 'No autenticado. Por favor, inicia sesión nuevamente.');
        }

        // SuperAdmin: acceso total.
        if ((int) $user->roleId === 1) {
            return $next($request);
        }

        $userPermissions = is_array($user->role?->permissions) ? $user->role->permissions : [];

        if (! array_intersect($permissions, $userPermissions)) {
            abort(403, 'No tienes permisos para realizar esta acción: '.implode(', ', $permissions));
        }

        return $next($request);
    }
}
