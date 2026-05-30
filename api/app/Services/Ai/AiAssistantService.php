<?php

namespace App\Services\Ai;

/**
 * Contrato del asistente de IA del módulo de mensajería.
 *
 * Permite cambiar de proveedor (Claude, OpenAI, Groq, etc.) sin tocar la UI
 * ni los controllers — solo cambia la implementación registrada en el
 * service container.
 */
interface AiAssistantService
{
    /**
     * Genera una respuesta sugerida para el último mensaje del cliente.
     *
     * @param  array  $history  Historial cronológico de la conversación.
     *                          Cada entrada: ['role' => 'contact'|'user'|'bot', 'content' => '...'].
     * @param  array  $context  Datos adicionales: nombre del contacto, canal, etc.
     * @return string Texto sugerido (puede mostrarse al operador o enviarse automáticamente).
     */
    public function suggestReply(array $history, array $context = []): string;

    /**
     * Identificador legible del proveedor activo (para mostrar en la UI).
     */
    public function providerName(): string;
}
