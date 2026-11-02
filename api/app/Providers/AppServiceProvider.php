<?php

namespace App\Providers;

use App\Services\Ai\AiAssistantService;
use App\Services\Ai\GroqAiAssistant;
use App\Services\Ai\MockAiAssistant;
use Dedoc\Scramble\Scramble;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Asistente de IA del módulo de mensajería. Selección por env:
        //   AI_PROVIDER=groq → usa Groq (gratis hasta 14k requests/día con Llama 3)
        //   AI_PROVIDER=mock → respuestas heurísticas locales (default si no hay key)
        // Si AI_PROVIDER=groq pero falta GROQ_API_KEY, el driver cae al mock
        // automáticamente para que la app no se rompa.
        $provider = strtolower((string) env('AI_PROVIDER', 'mock'));
        $impl = match ($provider) {
            'groq' => GroqAiAssistant::class,
            default => MockAiAssistant::class,
        };
        $this->app->bind(AiAssistantService::class, $impl);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiting();

        // Un usuario desactivado o suspendido no puede seguir usando sus tokens (antes el
        // estado solo se revisaba al iniciar sesión).
        Sanctum::authenticateAccessTokensUsing(
            fn ($token, bool $isValid) => $isValid && ($token->tokenable?->status ?? 'ACTIVE') === 'ACTIVE'
        );

        // La documentación de la API (Scramble) se publica en /api/doc
        // (como la tenía el backend anterior en Node). El JSON OpenAPI
        // queda en /api/doc.json. Por defecto Scramble la pone en /docs/api.
        Scramble::configure()->expose(
            ui: 'api/doc',
            document: 'api/doc.json',
        );

        // Acceso en producción: Scramble solo muestra la doc en local por
        // defecto. Aquí la abrimos también en producción SOLO si la petición
        // trae ?token=... igual a SCRAMBLE_DOCS_TOKEN. Una vez validado, se
        // recuerda en la sesión para no repetir el token al navegar.
        Gate::define('viewApiDocs', function ($user = null) {
            $expected = (string) env('SCRAMBLE_DOCS_TOKEN', '');

            if ($expected === '') {
                return app()->environment('local');
            }

            $provided = (string) request()->query('token', '');
            if ($provided !== '' && hash_equals($expected, $provided)) {
                session(['scramble_docs_ok' => true]);

                return true;
            }

            return (bool) session('scramble_docs_ok', false);
        });
    }

    /**
     * Límites de peticiones (antes no había ninguno). Por IP y, en el login, también por
     * email, porque la IP es falsificable tras el proxy (trustProxies '*').
     */
    private function configureRateLimiting(): void
    {
        $byUserOrIp = fn (Request $r) => $r->user()?->id ? 'u'.$r->user()->id : 'ip'.$r->ip();

        // Login: 10 por minuto por IP y 5 por minuto por email (fuerza bruta de contraseñas).
        RateLimiter::for('login', fn (Request $r) => [
            Limit::perMinute(10)->by('ip'.$r->ip()),
            Limit::perMinute(5)->by('email'.strtolower((string) $r->input('email'))),
        ]);
        // Registro, olvido y reset de contraseña: 5 por minuto por IP.
        RateLimiter::for('auth-sensitive', fn (Request $r) => Limit::perMinute(5)->by('ip'.$r->ip()));
        // Validar cupones: evita enumerar códigos.
        RateLimiter::for('coupons', fn (Request $r) => Limit::perMinute(20)->by($byUserOrIp($r)));
        // Chat web: cada mensaje dispara una llamada a la IA (con costo).
        RateLimiter::for('webchat', fn (Request $r) => Limit::perMinute(20)->by('ip'.$r->ip()));
        // Subidas de imágenes.
        RateLimiter::for('uploads', fn (Request $r) => Limit::perMinute(30)->by($byUserOrIp($r)));
        // Imágenes redimensionadas: cada variante nueva cuesta CPU y disco.
        RateLimiter::for('images', fn (Request $r) => Limit::perMinute(300)->by('ip'.$r->ip()));
        // Bloques públicos de la portada (reseñas destacadas, categorías con conteo).
        RateLimiter::for('storefront', fn (Request $r) => Limit::perMinute(60)->by('ip'.$r->ip()));
    }
}
