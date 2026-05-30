<?php

namespace App\Services\Messaging\Channels;

use App\Models\Conversation;

/**
 * Contrato común para todos los canales externos (Messenger, Instagram,
 * WhatsApp, SMS…). Permite que MessagingService despache outbound sin
 * conocer al proveedor y que cada webhook entrante caiga por el mismo
 * embudo `parseInboundWebhook`.
 *
 * El canal "webchat" no implementa este driver porque el cliente lo lee
 * directamente desde la BD vía polling.
 */
interface ChannelDriver
{
    /**
     * Envía un mensaje saliente al proveedor externo.
     *
     * @return array{externalId?: string|null, status?: string}
     */
    public function send(Conversation $conversation, string $content): array;

    /**
     * Procesa un webhook entrante del proveedor y persiste los mensajes.
     * Devuelve un resumen para logging.
     */
    public function handleInbound(array $payload): array;
}
