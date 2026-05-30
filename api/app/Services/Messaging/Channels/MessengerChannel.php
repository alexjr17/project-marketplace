<?php

namespace App\Services\Messaging\Channels;

use App\Models\Channel;
use App\Models\Contact;
use App\Models\Conversation;
use App\Services\MessagingService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * Integración con Facebook Messenger (Meta Graph API):
 * - Verifica el handshake del webhook (hub.challenge).
 * - Valida la firma X-Hub-Signature-256 usando el App Secret.
 * - Procesa eventos entrantes (mensajes de usuarios a la Página).
 * - Envía mensajes salientes vía POST /me/messages con el Page Access Token.
 */
class MessengerChannel implements ChannelDriver
{
    private const GRAPH_VERSION = 'v19.0';

    public function __construct(private MessagingService $messaging) {}

    // ============================== CONFIG ==============================

    private function channel(): ?Channel
    {
        return Channel::where('type', 'messenger')->first();
    }

    private function config(): array
    {
        $channel = $this->channel();

        return $channel ? (array) $channel->config : [];
    }

    private function token(): string
    {
        return (string) ($this->config()['pageAccessToken'] ?? '');
    }

    // ============================== WEBHOOK VERIFY (GET) ==============================

    /**
     * Maneja el handshake inicial que Meta hace al suscribir el webhook.
     * Devuelve el challenge si el verifyToken coincide; null si no.
     */
    public function verifyWebhook(?string $mode, ?string $token, ?string $challenge): ?string
    {
        $expected = (string) ($this->config()['verifyToken'] ?? '');

        if ($mode !== 'subscribe' || $expected === '' || $token !== $expected) {
            return null;
        }

        return $challenge;
    }

    // ============================== FIRMA HMAC ==============================

    /**
     * Valida la firma X-Hub-Signature-256 que Meta envía con cada webhook.
     * En desarrollo (sin App Secret configurado) se permite.
     */
    public function verifySignature(string $rawBody, ?string $signatureHeader): bool
    {
        $secret = (string) ($this->config()['appSecret'] ?? '');
        if ($secret === '') {
            return true; // Modo desarrollo
        }

        if (! $signatureHeader || ! str_starts_with($signatureHeader, 'sha256=')) {
            return false;
        }

        $expected = 'sha256='.hash_hmac('sha256', $rawBody, $secret);

        return hash_equals($expected, $signatureHeader);
    }

    // ============================== INBOUND ==============================

    public function handleInbound(array $payload): array
    {
        $channel = $this->channel();
        if (! $channel) {
            return ['processed' => 0, 'reason' => 'Canal messenger no configurado'];
        }

        $processed = 0;

        // Estructura del payload:
        // { object: "page", entry: [ { id, time, messaging: [ { sender:{id}, recipient:{id}, timestamp, message:{mid, text, attachments?:[]} } ] } ] }
        foreach ((array) ($payload['entry'] ?? []) as $entry) {
            foreach ((array) ($entry['messaging'] ?? []) as $event) {
                $psid = (string) ($event['sender']['id'] ?? '');
                $message = $event['message'] ?? null;

                if (! $psid || ! $message) {
                    continue; // delivery, read, postbacks → ignorar por ahora
                }
                // Ignorar nuestros propios mensajes (echo)
                if (! empty($message['is_echo'])) {
                    continue;
                }

                $text = isset($message['text']) ? (string) $message['text'] : '';
                $mid = isset($message['mid']) ? (string) $message['mid'] : null;
                $attachments = $this->parseAttachments($message['attachments'] ?? []);

                // Si no hay ni texto ni attachments, no hay nada que guardar.
                if ($text === '' && empty($attachments)) {
                    continue;
                }

                // Si no hay texto pero sí attachments, generar un placeholder
                // descriptivo para listados/previews ("📎 Imagen", etc.).
                if ($text === '' && ! empty($attachments)) {
                    $text = $this->describeAttachments($attachments);
                }

                $contact = $this->upsertContact($channel, $psid);
                $conversation = $this->ensureConversation($channel, $contact);

                $this->messaging->receiveInboundMessage($conversation, $text, $attachments, $mid);
                $processed++;
            }
        }

        return ['processed' => $processed];
    }

    /**
     * Normaliza el array de attachments del payload de Meta a una forma simple
     * que el frontend pueda renderizar sin saber del esquema interno de Meta:
     *   [{ type, url, name?, lat?, lng? }, ...]
     */
    private function parseAttachments(array $atts): array
    {
        $out = [];
        foreach ($atts as $a) {
            $type = (string) ($a['type'] ?? '');
            $payload = (array) ($a['payload'] ?? []);
            $entry = ['type' => $type ?: 'unknown'];

            if (isset($payload['url'])) {
                $entry['url'] = (string) $payload['url'];
                // Nombre derivado del archivo si es 'file'.
                if ($type === 'file') {
                    $pathParts = parse_url($entry['url'])['path'] ?? '';
                    $entry['name'] = $pathParts ? basename($pathParts) : 'archivo';
                }
            }
            if (isset($payload['coordinates'])) {
                $entry['lat'] = (float) ($payload['coordinates']['lat'] ?? 0);
                $entry['lng'] = (float) ($payload['coordinates']['long'] ?? 0);
            }
            if (isset($payload['sticker_id'])) {
                $entry['stickerId'] = (string) $payload['sticker_id'];
            }
            $out[] = $entry;
        }

        return $out;
    }

    private function describeAttachments(array $atts): string
    {
        $labels = [
            'image' => '📷 Imagen',
            'video' => '🎥 Video',
            'audio' => '🎵 Audio',
            'file' => '📎 Archivo',
            'location' => '📍 Ubicación',
            'fallback' => '🔗 Enlace',
        ];
        $count = count($atts);
        if ($count === 1) {
            return $labels[$atts[0]['type']] ?? '📎 Adjunto';
        }

        return "📎 {$count} adjuntos";
    }

    private function upsertContact(Channel $channel, string $psid): Contact
    {
        $existing = Contact::whereJsonContains('externalIds->messenger', $psid)->first();
        if ($existing) {
            return $existing;
        }

        // Intentar obtener el nombre del usuario (no siempre permitido sin permisos extra).
        $name = $this->fetchUserName($psid);

        $contact = new Contact;
        $contact->name = $name ?: "Visitante Messenger {$psid}";
        $contact->externalIds = ['messenger' => $psid];
        $contact->metadata = ['source' => 'messenger', 'pageId' => $channel->config['pageId'] ?? null];
        $contact->save();

        return $contact;
    }

    private function ensureConversation(Channel $channel, Contact $contact): Conversation
    {
        $existing = Conversation::where('channelId', $channel->id)
            ->where('contactId', $contact->id)
            ->whereIn('status', ['open', 'pending'])
            ->orderByDesc('id')
            ->first();

        if ($existing) {
            return $existing;
        }

        $conversation = new Conversation;
        $conversation->channelId = $channel->id;
        $conversation->contactId = $contact->id;
        $conversation->status = 'open';
        $conversation->aiEnabled = (bool) $channel->aiAutoReply;
        $conversation->save();

        return $conversation;
    }

    private function fetchUserName(string $psid): ?string
    {
        $token = $this->token();
        if (! $token) {
            return null;
        }

        try {
            $response = Http::timeout(5)->get("https://graph.facebook.com/".self::GRAPH_VERSION."/{$psid}", [
                'fields' => 'name,first_name,last_name',
                'access_token' => $token,
            ]);
            if (! $response->successful()) {
                return null;
            }
            $data = $response->json();

            return $data['name'] ?? null;
        } catch (Throwable $e) {
            Log::warning('[Messenger] No se pudo obtener nombre del usuario: '.$e->getMessage());

            return null;
        }
    }

    // ============================== OUTBOUND ==============================

    public function send(Conversation $conversation, string $content): array
    {
        $token = $this->token();
        if (! $token) {
            throw new RuntimeException('Page Access Token no configurado para Messenger');
        }

        $psid = (string) ($conversation->contact->externalIds['messenger'] ?? '');
        if (! $psid) {
            throw new RuntimeException('El contacto no tiene PSID de Messenger');
        }

        $response = Http::timeout(10)
            ->withQueryParameters(['access_token' => $token])
            ->post('https://graph.facebook.com/'.self::GRAPH_VERSION.'/me/messages', [
                'recipient' => ['id' => $psid],
                'message' => ['text' => $content],
                'messaging_type' => 'RESPONSE',
            ]);

        if (! $response->successful()) {
            $error = $response->json('error.message') ?? $response->body();
            throw new RuntimeException("Meta rechazó el mensaje: {$error}");
        }

        return [
            'externalId' => $response->json('message_id'),
            'status' => 'sent',
        ];
    }
}
