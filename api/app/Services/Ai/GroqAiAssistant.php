<?php

namespace App\Services\Ai;

use App\Models\BotKnowledge;
use App\Models\BotKnowledgeCategory;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Asistente de IA usando Groq Cloud (https://console.groq.com).
 *
 * Groq corre modelos open-source de Meta (Llama 3) en hardware ultra-rápido.
 * El plan gratuito da ~14.400 requests/día sin tarjeta — suficiente para
 * pilotear un bot de atención al cliente.
 *
 * La API es compatible con OpenAI (mismo formato de mensajes), por lo que
 * cambiar a OpenAI o cualquier proveedor compatible es trivial.
 */
class GroqAiAssistant implements AiAssistantService
{
    private const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

    public function providerName(): string
    {
        return 'Groq · Llama 3';
    }

    public function suggestReply(array $history, array $context = []): string
    {
        $apiKey = (string) env('GROQ_API_KEY', '');
        if ($apiKey === '') {
            // Falla silenciosa: devolvemos una respuesta de emergencia y log para
            // que el operador no quede sin nada que mostrar/enviar.
            Log::warning('[Groq] GROQ_API_KEY no configurada; cayendo a respuesta fallback');

            return app(MockAiAssistant::class)->suggestReply($history, $context);
        }

        $model = (string) env('GROQ_MODEL', 'llama-3.1-8b-instant');
        $businessName = (string) env('APP_NAME', 'Vexa');
        $contactName = (string) ($context['contactName'] ?? '');

        // Mensaje del sistema (la "personalidad" del bot).
        $system = <<<SYSTEM
Eres el asistente virtual de la tienda **{$businessName}**. Atiendes mensajes
de clientes en español colombiano por chat (Messenger, WhatsApp y chat web).

Reglas:
- Saluda al cliente por su nombre si lo conoces.
- Sé cálido, directo y concreto. Sin emojis innecesarios — máximo uno por respuesta.
- Si no sabes algo específico (precio exacto, stock, dirección concreta), responde con honestidad y di que un asesor humano te confirmará en breve.
- Nunca inventes datos de la tienda (números de cuenta, direcciones, políticas) si no aparecen en el contexto que se te da.
- Máximo 3 frases. Si la pregunta es compleja, responde la parte que sí sabes y deriva el resto al asesor humano.
- Si el cliente solo saluda, responde con un saludo cálido y pregunta en qué le puedes ayudar.
- Idioma: siempre responde en español, incluso si el cliente escribe en otro idioma.
SYSTEM;

        // Inyectar la base de conocimiento configurada por el admin.
        $knowledgeBlock = $this->buildKnowledgeBlock();
        if ($knowledgeBlock !== '') {
            $system .= "\n\n".$knowledgeBlock;
        }

        // Convertir el historial a formato OpenAI chat.
        $messages = [['role' => 'system', 'content' => $system]];

        if ($contactName !== '') {
            $messages[] = [
                'role' => 'system',
                'content' => "El nombre del cliente con el que hablas es: {$contactName}.",
            ];
        }

        foreach ($history as $turn) {
            $role = ($turn['role'] ?? '') === 'contact' ? 'user' : 'assistant';
            $content = (string) ($turn['content'] ?? '');
            if ($content === '') {
                continue;
            }
            $messages[] = ['role' => $role, 'content' => $content];
        }

        // Por si el último turno no es del cliente (corner case), no pasa nada —
        // Groq igual genera la siguiente respuesta del assistant.
        try {
            $response = Http::timeout(15)
                ->withToken($apiKey)
                ->acceptJson()
                ->post(self::ENDPOINT, [
                    'model' => $model,
                    'messages' => $messages,
                    'temperature' => 0.4,
                    'max_tokens' => 250,
                    'top_p' => 0.9,
                ]);

            if (! $response->successful()) {
                $err = $response->json('error.message') ?? $response->body();
                Log::warning('[Groq] Respuesta no-OK', ['status' => $response->status(), 'err' => $err]);

                return app(MockAiAssistant::class)->suggestReply($history, $context);
            }

            $text = (string) ($response->json('choices.0.message.content') ?? '');
            $text = trim($text);

            if ($text === '') {
                Log::warning('[Groq] Respuesta vacía del modelo');

                return app(MockAiAssistant::class)->suggestReply($history, $context);
            }

            return $text;
        } catch (Throwable $e) {
            Log::error('[Groq] Excepción al llamar la API: '.$e->getMessage());

            return app(MockAiAssistant::class)->suggestReply($history, $context);
        }
    }

    /**
     * Carga la base de conocimiento activa (módulo /messaging/knowledge) y
     * la formatea por categorías como secciones legibles para el LLM.
     * Si no hay nada configurado devuelve string vacío.
     */
    private function buildKnowledgeBlock(): string
    {
        try {
            $entries = BotKnowledge::where('isActive', true)
                ->orderBy('category')
                ->orderBy('sortOrder')
                ->orderBy('id')
                ->get();

            // Mapa slug → etiqueta a partir de la tabla editable de categorías.
            // Si la tabla no existe (antes de migrar) cae al try/catch externo.
            $labels = BotKnowledgeCategory::pluck('label', 'slug')->all();
        } catch (Throwable) {
            // Tablas aún no migradas — el bot sigue funcionando sin contexto extra.
            return '';
        }

        if ($entries->isEmpty()) {
            return '';
        }

        $byCategory = $entries->groupBy('category');
        $sections = [
            '=== CONTEXTO DEL NEGOCIO (úsalo para responder con precisión) ===',
        ];

        foreach ($byCategory as $cat => $items) {
            // Fallback: si el slug no está en la tabla de categorías (categoría
            // eliminada o slug renombrado), usamos el slug en mayúsculas.
            $label = strtoupper((string) ($labels[$cat] ?? $cat));
            $sections[] = "\n--- {$label} ---";
            foreach ($items as $k) {
                $sections[] = "- {$k->title}: {$k->content}";
            }
        }

        $sections[] = "\n=== FIN DEL CONTEXTO ===";

        return implode("\n", $sections);
    }
}
