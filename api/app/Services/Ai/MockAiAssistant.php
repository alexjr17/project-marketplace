<?php

namespace App\Services\Ai;

/**
 * Implementación simulada del asistente de IA.
 * Devuelve respuestas plausibles basadas en heurísticas simples sobre el
 * último mensaje del cliente. Suficiente para probar UI y flujos sin gastar
 * tokens en APIs reales. Se reemplaza por ClaudeAiAssistant cuando se tenga
 * la clave de API.
 */
class MockAiAssistant implements AiAssistantService
{
    public function providerName(): string
    {
        return 'Mock (sin IA real)';
    }

    public function suggestReply(array $history, array $context = []): string
    {
        $lastClient = $this->findLastFromContact($history);
        $contactName = $context['contactName'] ?? '';
        $greeting = $contactName ? "Hola {$contactName}," : 'Hola,';

        if ($lastClient === null) {
            return "{$greeting} ¿en qué te podemos ayudar hoy?";
        }

        $text = mb_strtolower($lastClient);

        // Heurísticas básicas — el día que entre IA real, se borran y listo.
        if ($this->matches($text, ['precio', 'cuanto', 'cuánto', 'cuesta', 'vale'])) {
            return "{$greeting} con gusto te paso el precio. ¿Me confirmas el nombre o referencia del producto que te interesa?";
        }

        if ($this->matches($text, ['envio', 'envío', 'entrega', 'demora', 'cuándo llega', 'cuando llega'])) {
            return "{$greeting} los envíos suelen tardar entre 1 y 3 días hábiles según tu ciudad. ¿A qué ciudad sería el envío?";
        }

        if ($this->matches($text, ['pago', 'pagar', 'tarjeta', 'pse', 'nequi', 'transferencia'])) {
            return "{$greeting} aceptamos pagos por transferencia bancaria y otros métodos. ¿Quieres que te comparta los datos?";
        }

        if ($this->matches($text, ['talla', 'medida', 'tamaño', 'tamano'])) {
            return "{$greeting} manejamos tallas S, M, L y XL. ¿Qué talla sueles usar?";
        }

        if ($this->matches($text, ['devolucion', 'devolución', 'cambio', 'reembolso'])) {
            return "{$greeting} aceptamos cambios y devoluciones dentro de los 30 días posteriores a la entrega siempre que el producto esté en su estado original.";
        }

        if ($this->matches($text, ['gracias', 'muchas gracias'])) {
            return '¡Con gusto! Si necesitas algo más, aquí estamos. 😊';
        }

        if ($this->matches($text, ['hola', 'buenos', 'buenas'])) {
            return "{$greeting} bienvenido. ¿En qué te podemos ayudar?";
        }

        // Respuesta genérica de cierre.
        return "{$greeting} gracias por escribirnos. Un asesor revisará tu mensaje y te responderá en breve. ¿Hay algo más que quieras contarnos?";
    }

    private function findLastFromContact(array $history): ?string
    {
        for ($i = count($history) - 1; $i >= 0; $i--) {
            if (($history[$i]['role'] ?? '') === 'contact') {
                return (string) ($history[$i]['content'] ?? '');
            }
        }

        return null;
    }

    private function matches(string $haystack, array $needles): bool
    {
        foreach ($needles as $needle) {
            if (str_contains($haystack, $needle)) {
                return true;
            }
        }

        return false;
    }
}
