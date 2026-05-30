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
 * Integración con WhatsApp Business Cloud API (Meta).
 *
 * Diferencias con Messenger:
 * - El payload entrante viene como `entry[].changes[].value.messages[]`,
 *   no como `entry[].messaging[]`.
 * - El envío saliente va a /{PHONE_NUMBER_ID}/messages con `messaging_product=whatsapp`.
 * - El "PSID" aquí es el `wa_id` (el número del usuario, ej. 573001234567).
 *
 * En modo de prueba el número del que envías lo asigna Meta y solo puedes
 * enviarle a hasta 5 destinatarios que verifiques en el panel de Meta.
 */
class WhatsAppChannel implements ChannelDriver
{
    private const GRAPH_VERSION = 'v19.0';

    public function __construct(private MessagingService $messaging) {}

    // ============================== CONFIG ==============================

    private function channel(): ?Channel
    {
        return Channel::where('type', 'whatsapp')->first();
    }

    private function config(): array
    {
        $channel = $this->channel();

        return $channel ? (array) $channel->config : [];
    }

    private function token(): string
    {
        return (string) ($this->config()['permanentAccessToken'] ?? '');
    }

    private function phoneNumberId(): string
    {
        return (string) ($this->config()['phoneNumberId'] ?? '');
    }

    // ============================== WEBHOOK VERIFY (GET) ==============================

    /** Mismo handshake que Messenger: si verifyToken coincide, devolver challenge. */
    public function verifyWebhook(?string $mode, ?string $token, ?string $challenge): ?string
    {
        $expected = (string) ($this->config()['verifyToken'] ?? '');

        if ($mode !== 'subscribe' || $expected === '' || $token !== $expected) {
            return null;
        }

        return $challenge;
    }

    // ============================== FIRMA HMAC ==============================

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

    /**
     * Estructura del payload de WhatsApp:
     * {
     *   object: "whatsapp_business_account",
     *   entry: [{
     *     id: WABA_ID,
     *     changes: [{
     *       value: {
     *         messaging_product: "whatsapp",
     *         metadata: { display_phone_number, phone_number_id },
     *         contacts: [{ profile: {name}, wa_id }],
     *         messages: [{ from, id, timestamp, type, text:{body}, ... }]
     *       },
     *       field: "messages"
     *     }]
     *   }]
     * }
     */
    public function handleInbound(array $payload): array
    {
        $channel = $this->channel();
        if (! $channel) {
            return ['processed' => 0, 'reason' => 'Canal whatsapp no configurado'];
        }

        $processed = 0;

        foreach ((array) ($payload['entry'] ?? []) as $entry) {
            foreach ((array) ($entry['changes'] ?? []) as $change) {
                $value = (array) ($change['value'] ?? []);

                // Mapa de wa_id → nombre, para enriquecer contactos al volar.
                $names = [];
                foreach ((array) ($value['contacts'] ?? []) as $c) {
                    $waId = (string) ($c['wa_id'] ?? '');
                    $name = (string) (($c['profile']['name'] ?? '') ?: '');
                    if ($waId !== '') {
                        $names[$waId] = $name;
                    }
                }

                foreach ((array) ($value['messages'] ?? []) as $message) {
                    $from = (string) ($message['from'] ?? '');
                    $type = (string) ($message['type'] ?? '');
                    $mid = (string) ($message['id'] ?? '');

                    if (! $from) {
                        continue;
                    }

                    $text = '';
                    $attachments = [];

                    switch ($type) {
                        case 'text':
                            $text = (string) ($message['text']['body'] ?? '');
                            break;
                        case 'button':
                            $text = (string) ($message['button']['text'] ?? '');
                            break;
                        case 'interactive':
                            $text = (string) ($message['interactive']['button_reply']['title']
                                ?? $message['interactive']['list_reply']['title']
                                ?? '');
                            break;
                        case 'image':
                        case 'video':
                        case 'audio':
                        case 'document':
                        case 'sticker':
                            $att = $this->downloadMedia($message[$type] ?? [], $type);
                            if ($att) {
                                $attachments[] = $att;
                            }
                            // Caption opcional para imagen/video/document
                            $text = (string) ($message[$type]['caption'] ?? '');
                            break;
                        case 'location':
                            $attachments[] = [
                                'type' => 'location',
                                'lat' => (float) ($message['location']['latitude'] ?? 0),
                                'lng' => (float) ($message['location']['longitude'] ?? 0),
                            ];
                            $text = (string) ($message['location']['name'] ?? '');
                            break;
                    }

                    // Si no hay nada, salta
                    if ($text === '' && empty($attachments)) {
                        continue;
                    }
                    // Placeholder de preview si solo vino adjunto
                    if ($text === '' && ! empty($attachments)) {
                        $text = $this->describeAttachments($attachments);
                    }

                    $contact = $this->upsertContact($from, $names[$from] ?? null);
                    $conversation = $this->ensureConversation($channel, $contact);

                    $this->messaging->receiveInboundMessage($conversation, $text, $attachments, $mid);
                    $processed++;
                }
            }
        }

        return ['processed' => $processed];
    }

    private function upsertContact(string $waId, ?string $name): Contact
    {
        $existing = Contact::whereJsonContains('externalIds->whatsapp', $waId)->first();
        if ($existing) {
            // Si llegó nombre nuevo, lo guardamos.
            if ($name && (! $existing->name || str_starts_with((string) $existing->name, 'WhatsApp'))) {
                $existing->name = $name;
                $existing->save();
            }

            return $existing;
        }

        $contact = new Contact;
        $contact->name = $name ?: "WhatsApp +{$waId}";
        $contact->phone = $waId;
        $contact->externalIds = ['whatsapp' => $waId];
        $contact->metadata = ['source' => 'whatsapp'];
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

    // ============================== OUTBOUND ==============================

    public function send(Conversation $conversation, string $content): array
    {
        $token = $this->token();
        $phoneNumberId = $this->phoneNumberId();

        if (! $token) {
            throw new RuntimeException('Access Token no configurado para WhatsApp');
        }
        if (! $phoneNumberId) {
            throw new RuntimeException('Phone Number ID no configurado para WhatsApp');
        }

        $waId = (string) ($conversation->contact->externalIds['whatsapp'] ?? '');
        if (! $waId) {
            throw new RuntimeException('El contacto no tiene wa_id de WhatsApp');
        }

        try {
            $response = Http::timeout(10)
                ->withToken($token)
                ->acceptJson()
                ->post('https://graph.facebook.com/'.self::GRAPH_VERSION."/{$phoneNumberId}/messages", [
                    'messaging_product' => 'whatsapp',
                    'recipient_type' => 'individual',
                    'to' => $waId,
                    'type' => 'text',
                    'text' => [
                        'preview_url' => false,
                        'body' => $content,
                    ],
                ]);
        } catch (Throwable $e) {
            throw new RuntimeException('No se pudo contactar la Cloud API de WhatsApp: '.$e->getMessage());
        }

        if (! $response->successful()) {
            $error = $response->json('error.message') ?? $response->body();
            // Pistas comunes:
            //  - "Recipient phone number not in allowed list" → en modo test, el wa_id
            //    no está en los 5 testers verificados.
            //  - "Message failed to send because more than 24 hours have passed..." →
            //    fuera de la ventana de 24h hay que usar template message.
            Log::warning('[WhatsApp] Meta rechazó el envío', ['err' => $error, 'to' => $waId]);
            throw new RuntimeException("WhatsApp rechazó el mensaje: {$error}");
        }

        $messages = (array) $response->json('messages', []);
        $externalId = $messages[0]['id'] ?? null;

        return [
            'externalId' => $externalId,
            'status' => 'sent',
        ];
    }

    // ============================== MEDIA HELPERS ==============================

    /**
     * Descarga un media adjunto de WhatsApp y lo guarda local. Devuelve la
     * estructura que el frontend renderiza (con URL pública vía ngrok).
     *
     * Flujo Meta:
     *   1) GET /{MEDIA_ID}              → devuelve { url, mime_type, sha256 }
     *   2) GET {url} con bearer token   → descarga binario
     *   3) Guardamos en /public/uploads/whatsapp/{name.ext}
     */
    private function downloadMedia(array $mediaMeta, string $type): ?array
    {
        $mediaId = (string) ($mediaMeta['id'] ?? '');
        if ($mediaId === '') {
            return null;
        }
        $token = $this->token();
        if (! $token) {
            Log::warning('[WhatsApp] No token para descargar media '.$mediaId);

            return null;
        }

        try {
            // Paso 1: URL temporal del media
            $resMeta = Http::timeout(8)->withToken($token)
                ->get('https://graph.facebook.com/'.self::GRAPH_VERSION."/{$mediaId}");
            if (! $resMeta->successful()) {
                Log::warning('[WhatsApp] Meta no devolvió URL del media', ['id' => $mediaId, 'body' => $resMeta->body()]);

                return null;
            }
            $url = (string) ($resMeta->json('url') ?? '');
            $mime = (string) ($resMeta->json('mime_type') ?? ($mediaMeta['mime_type'] ?? ''));
            if ($url === '') {
                return null;
            }

            // Paso 2: descargar binario
            $resBin = Http::timeout(30)->withToken($token)->get($url);
            if (! $resBin->successful()) {
                Log::warning('[WhatsApp] No se pudo descargar binario del media', ['url' => $url]);

                return null;
            }
            $bytes = $resBin->body();

            // Paso 3: guardar archivo y exponer URL pública (vía ngrok)
            $ext = $this->extensionFromMime($mime) ?: 'bin';
            $name = "wa_{$type}_".time().'_'.bin2hex(random_bytes(4)).'.'.$ext;
            $dir = public_path('uploads/whatsapp');
            if (! is_dir($dir)) {
                mkdir($dir, 0775, true);
            }
            file_put_contents($dir.'/'.$name, $bytes);

            $publicBase = (string) env('NGROK_DOMAIN', '');
            $baseUrl = $publicBase ? 'https://'.ltrim($publicBase, '/') : '';
            $publicUrl = $baseUrl.'/uploads/whatsapp/'.$name;

            $original = (string) ($mediaMeta['filename'] ?? '');

            return [
                'type' => $type,
                'url' => $publicUrl,
                'name' => $original ?: $name,
                'mimeType' => $mime,
            ];
        } catch (Throwable $e) {
            Log::error('[WhatsApp] downloadMedia: '.$e->getMessage());

            return null;
        }
    }

    private function extensionFromMime(string $mime): ?string
    {
        $map = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/gif' => 'gif',
            'video/mp4' => 'mp4',
            'video/3gpp' => '3gp',
            'audio/mpeg' => 'mp3',
            'audio/ogg' => 'ogg',
            'audio/aac' => 'aac',
            'audio/mp4' => 'm4a',
            'audio/amr' => 'amr',
            'application/pdf' => 'pdf',
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            'application/vnd.ms-excel' => 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
        ];

        return $map[strtolower($mime)] ?? null;
    }

    private function describeAttachments(array $atts): string
    {
        $labels = [
            'image' => '📷 Imagen',
            'video' => '🎥 Video',
            'audio' => '🎵 Audio',
            'document' => '📎 Documento',
            'sticker' => '✨ Sticker',
            'location' => '📍 Ubicación',
        ];

        return $labels[$atts[0]['type'] ?? ''] ?? '📎 Adjunto';
    }
}
