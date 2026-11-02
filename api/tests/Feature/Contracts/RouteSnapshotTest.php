<?php

namespace Tests\Feature\Contracts;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Foto de todas las rutas de la API con su autenticación, permisos y límites.
 * Red de seguridad del refactor: mover controladores o partir routes/api.php no debe
 * cambiar quién puede llamar qué. Si un cambio de acceso es intencional, se regenera con
 *   UPDATE_ROUTE_SNAPSHOT=1 php artisan test --filter=RouteSnapshotTest
 * y la diferencia queda visible en el PR (tests/Fixtures/routes.snapshot.json).
 */
class RouteSnapshotTest extends TestCase
{
    private const FIXTURE = __DIR__.'/../../Fixtures/routes.snapshot.json';

    /** @return array<string, string[]> "MÉTODO uri" => middlewares relevantes, ordenados. */
    private function currentRoutes(): array
    {
        $out = [];
        foreach (Route::getRoutes() as $route) {
            $uri = $route->uri();
            if (! str_starts_with($uri, 'api/')) {
                continue;
            }
            $middleware = array_values(array_filter(
                $route->gatherMiddleware(),
                fn ($m) => is_string($m) && $m !== 'api',
            ));
            sort($middleware);
            foreach (array_diff($route->methods(), ['HEAD']) as $method) {
                $out["{$method} {$uri}"] = $middleware;
            }
        }
        ksort($out);

        return $out;
    }

    public function test_las_rutas_y_sus_permisos_no_cambian_sin_querer(): void
    {
        $current = $this->currentRoutes();

        if (getenv('UPDATE_ROUTE_SNAPSHOT') || ! file_exists(self::FIXTURE)) {
            @mkdir(dirname(self::FIXTURE), 0777, true);
            file_put_contents(self::FIXTURE, json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)."\n");
            $this->markTestSkipped('Foto de rutas regenerada: revisa el diff de tests/Fixtures/routes.snapshot.json.');
        }

        $expected = json_decode((string) file_get_contents(self::FIXTURE), true);

        $added = array_diff_key($current, $expected);
        $removed = array_diff_key($expected, $current);
        $changed = [];
        foreach (array_intersect_key($current, $expected) as $key => $mw) {
            if ($mw !== $expected[$key]) {
                $changed[$key] = ['antes' => $expected[$key], 'ahora' => $mw];
            }
        }

        $this->assertSame([], $added, 'Rutas nuevas sin registrar en la foto');
        $this->assertSame([], $removed, 'Rutas que desaparecieron');
        $this->assertSame([], $changed, 'Rutas cuyo acceso cambió');
    }

    public function test_ninguna_ruta_de_escritura_del_panel_queda_sin_autenticacion(): void
    {
        // Escrituras públicas permitidas a propósito (login, webhooks, carrito de invitado…).
        $publicWrites = [
            'POST api/auth/register', 'POST api/auth/login', 'POST api/auth/forgot-password',
            'POST api/auth/reset-password', 'POST api/auth/logout',
            'POST api/webhooks/wompi', 'POST api/webhooks/mercadopago',
            'POST api/webhooks/messenger', 'POST api/webhooks/whatsapp',
            'POST api/discounts/validate',
            'POST api/webchat/start', 'POST api/webchat/send',
        ];

        $unprotected = [];
        foreach ($this->currentRoutes() as $key => $mw) {
            [$method] = explode(' ', $key, 2);
            if ($method === 'GET' || in_array($key, $publicWrites, true)) {
                continue;
            }
            $hasAuth = (bool) array_filter($mw, fn ($m) => str_starts_with($m, 'auth:') || $m === 'auth.optional');
            if (! $hasAuth) {
                $unprotected[] = $key;
            }
        }

        $this->assertSame([], $unprotected, 'Escrituras sin autenticación');
    }
}
