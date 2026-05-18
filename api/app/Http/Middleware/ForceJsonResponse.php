<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Fuerza que todas las rutas /api/* respondan en JSON, sin importar
 * la cabecera Accept que envíe el cliente. Así la validación, los
 * errores de autenticación y las excepciones siempre salen como JSON.
 */
class ForceJsonResponse
{
    public function handle(Request $request, Closure $next): Response
    {
        $request->headers->set('Accept', 'application/json');

        return $next($request);
    }
}
