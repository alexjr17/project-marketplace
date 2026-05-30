<?php

namespace App\Providers;

use App\Services\Ai\AiAssistantService;
use App\Services\Ai\GroqAiAssistant;
use App\Services\Ai\MockAiAssistant;
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
        //
    }
}
