<?php

namespace App\Providers;

use App\Services\Ai\AiAssistantService;
use App\Services\Ai\GroqAiAssistant;
use App\Services\Ai\MockAiAssistant;
use Dedoc\Scramble\Scramble;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

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
}
