<?php

namespace App\Services;

use App\Models\Channel;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
use App\Services\Ai\AiAssistantService;
use App\Services\Messaging\Channels\ChannelDriver;
use App\Services\Messaging\Channels\MessengerChannel;
use App\Services\Messaging\Channels\WhatsAppChannel;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/**
 * Orquesta el flujo del módulo de mensajería: creación de conversaciones,
 * registro de mensajes (entrantes/salientes), autorespuestas con IA,
 * formateo para la API.
 */
class MessagingService
{
    public function __construct(private AiAssistantService $ai) {}

    // ============================== CONSULTAS ==============================

    public function listConversations(array $filters = []): array
    {
        $query = Conversation::with(['channel', 'contact', 'assignee'])
            ->orderByDesc('lastMessageAt')
            ->orderByDesc('id');

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['channelId'])) {
            $query->where('channelId', (int) $filters['channelId']);
        }
        if (! empty($filters['assigneeUserId'])) {
            $query->where('assigneeUserId', (int) $filters['assigneeUserId']);
        }
        if (! empty($filters['search'])) {
            $search = '%'.$filters['search'].'%';
            $query->whereHas('contact', fn ($q) => $q
                ->where('name', 'like', $search)
                ->orWhere('email', 'like', $search)
                ->orWhere('phone', 'like', $search));
        }

        $perPage = max(1, min(100, (int) ($filters['perPage'] ?? 20)));
        $paginator = $query->paginate($perPage);

        return [
            'data' => collect($paginator->items())->map(fn ($c) => $this->formatConversation($c))->all(),
            'pagination' => [
                'page' => $paginator->currentPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'totalPages' => $paginator->lastPage(),
            ],
        ];
    }

    public function getConversation(int $id): Conversation
    {
        $conversation = Conversation::with(['channel', 'contact', 'assignee'])->find($id);
        if (! $conversation) {
            throw new RuntimeException('Conversación no encontrada', 404);
        }

        return $conversation;
    }

    public function listMessages(int $conversationId, ?int $sinceId = null): array
    {
        $this->getConversation($conversationId); // valida existencia

        $query = Message::where('conversationId', $conversationId)->orderBy('id');
        if ($sinceId !== null) {
            $query->where('id', '>', $sinceId);
        }

        return $query->get()->map(fn ($m) => $this->formatMessage($m))->all();
    }

    // ============================== MUTACIONES ==============================

    /**
     * Inicia (o reanuda) una conversación de chat web para un visitante.
     * Genera un token de sesión que el widget usa para autenticar polling/send.
     */
    public function startWebChat(array $data): array
    {
        $channel = Channel::where('type', 'webchat')->where('isActive', true)->first();
        if (! $channel) {
            throw new RuntimeException('El chat web no está habilitado', 503);
        }

        $contact = $this->upsertWebContact($data);

        $conversation = new Conversation;
        $conversation->channelId = $channel->id;
        $conversation->contactId = $contact->id;
        $conversation->status = 'open';
        $conversation->aiEnabled = (bool) $channel->aiAutoReply;
        $conversation->sessionToken = Str::random(48);
        $conversation->save();

        return [
            'conversationId' => $conversation->id,
            'sessionToken' => $conversation->sessionToken,
            'aiEnabled' => $conversation->aiEnabled,
            'channel' => ['id' => $channel->id, 'name' => $channel->name, 'type' => $channel->type],
        ];
    }

    /** Verifica el token y devuelve la conversación asociada. */
    public function authenticateWebSession(string $token): Conversation
    {
        $conversation = Conversation::where('sessionToken', $token)->first();
        if (! $conversation) {
            throw new RuntimeException('Sesión inválida o expirada', 401);
        }

        return $conversation;
    }

    /**
     * Registra un mensaje INBOUND (entrante: del contacto a la empresa).
     * Si la conversación tiene IA habilitada, genera una respuesta automática.
     */
    public function receiveInboundMessage(Conversation $conversation, string $content, array $attachments = [], ?string $channelMessageId = null): array
    {
        $message = $this->storeMessage($conversation, [
            'direction' => 'inbound',
            'senderType' => 'contact',
            'content' => $content,
            'attachments' => $attachments,
            'channelMessageId' => $channelMessageId,
        ]);

        $conversation->unreadCount = ($conversation->unreadCount ?? 0) + 1;
        $this->touchLastMessage($conversation, $content);

        $botMessage = null;
        if ($conversation->aiEnabled) {
            $botMessage = $this->generateAiReply($conversation);
        }

        return [
            'message' => $this->formatMessage($message),
            'botReply' => $botMessage ? $this->formatMessage($botMessage) : null,
        ];
    }

    /** Registra un mensaje OUTBOUND enviado por un operador desde el panel. */
    public function sendOperatorMessage(Conversation $conversation, int $userId, string $content): Message
    {
        $message = $this->storeMessage($conversation, [
            'direction' => 'outbound',
            'senderType' => 'user',
            'senderUserId' => $userId,
            'content' => $content,
        ]);

        $this->touchLastMessage($conversation, $content);
        $this->dispatchToChannel($conversation, $message, $content);

        return $message;
    }

    /** Genera y devuelve UNA sugerencia de IA sin guardarla (para el botón "Sugerir"). */
    public function suggestReply(Conversation $conversation): string
    {
        $history = $this->buildHistory($conversation);
        $context = ['contactName' => optional($conversation->contact)->name];

        return $this->ai->suggestReply($history, $context);
    }

    /** Actualiza estado / asignación de una conversación. */
    public function updateConversation(int $id, array $data): Conversation
    {
        $conversation = $this->getConversation($id);

        foreach (['status', 'assigneeUserId', 'aiEnabled'] as $field) {
            if (array_key_exists($field, $data)) {
                $conversation->{$field} = $data[$field];
            }
        }
        $conversation->save();

        return $conversation->fresh(['channel', 'contact', 'assignee']);
    }

    public function markRead(int $id): Conversation
    {
        $conversation = $this->getConversation($id);
        $conversation->unreadCount = 0;
        $conversation->save();

        return $conversation;
    }

    // ============================== FORMATEO ==============================

    public function formatConversation(Conversation $c): array
    {
        return [
            'id' => $c->id,
            'channelId' => $c->channelId,
            'channel' => $c->channel ? [
                'id' => $c->channel->id,
                'type' => $c->channel->type,
                'name' => $c->channel->name,
            ] : null,
            'contactId' => $c->contactId,
            'contact' => $c->contact ? [
                'id' => $c->contact->id,
                'name' => $c->contact->name,
                'email' => $c->contact->email,
                'phone' => $c->contact->phone,
                'avatarUrl' => $c->contact->avatarUrl,
            ] : null,
            'status' => $c->status,
            'assigneeUserId' => $c->assigneeUserId,
            'assigneeName' => optional($c->assignee)->name,
            'aiEnabled' => (bool) $c->aiEnabled,
            'lastMessageAt' => optional($c->lastMessageAt)->toIso8601String(),
            'lastMessagePreview' => $c->lastMessagePreview,
            'unreadCount' => (int) $c->unreadCount,
            'createdAt' => optional($c->createdAt)->toIso8601String(),
        ];
    }

    public function formatMessage(Message $m): array
    {
        return [
            'id' => $m->id,
            'conversationId' => $m->conversationId,
            'direction' => $m->direction,
            'senderType' => $m->senderType,
            'senderUserId' => $m->senderUserId,
            'content' => $m->content,
            'attachments' => $m->attachments,
            'status' => $m->status,
            'createdAt' => optional($m->createdAt)->toIso8601String(),
        ];
    }

    // ============================== INTERNOS ==============================

    private function upsertWebContact(array $data): Contact
    {
        $email = $data['email'] ?? null;
        if ($email) {
            $existing = Contact::where('email', $email)->first();
            if ($existing) {
                $existing->name = $data['name'] ?? $existing->name;
                $existing->phone = $data['phone'] ?? $existing->phone;
                $existing->userId = $data['userId'] ?? $existing->userId;
                $existing->save();

                return $existing;
            }
        }

        $contact = new Contact;
        $contact->name = $data['name'] ?? 'Visitante';
        $contact->email = $email;
        $contact->phone = $data['phone'] ?? null;
        $contact->userId = $data['userId'] ?? null;
        $contact->save();

        return $contact;
    }

    private function storeMessage(Conversation $conversation, array $data): Message
    {
        $message = new Message;
        $message->conversationId = $conversation->id;
        $message->direction = $data['direction'];
        $message->senderType = $data['senderType'];
        $message->senderUserId = $data['senderUserId'] ?? null;
        $message->content = $data['content'] ?? null;
        $message->attachments = $data['attachments'] ?? null;
        $message->channelMessageId = $data['channelMessageId'] ?? null;
        $message->status = 'sent';
        $message->save();

        return $message;
    }

    private function touchLastMessage(Conversation $conversation, string $content): void
    {
        $conversation->lastMessageAt = now();
        $conversation->lastMessagePreview = mb_substr($content, 0, 197);
        if (strlen($content) > 197) {
            $conversation->lastMessagePreview .= '…';
        }
        $conversation->save();
    }

    private function generateAiReply(Conversation $conversation): Message
    {
        $history = $this->buildHistory($conversation);
        $context = ['contactName' => optional($conversation->contact)->name];
        $reply = $this->ai->suggestReply($history, $context);

        $botMsg = $this->storeMessage($conversation, [
            'direction' => 'outbound',
            'senderType' => 'bot',
            'content' => $reply,
        ]);

        $this->touchLastMessage($conversation, $reply);
        $this->dispatchToChannel($conversation, $botMsg, $reply);

        return $botMsg;
    }

    /**
     * Despacha el mensaje saliente al canal externo (Messenger, etc.) si aplica.
     * Webchat no tiene driver — el cliente lee directamente desde la BD vía polling.
     */
    private function dispatchToChannel(Conversation $conversation, Message $message, string $content): void
    {
        $driver = $this->driverFor($conversation->channel);
        if (! $driver) {
            return;
        }

        try {
            $result = $driver->send($conversation, $content);
            if (! empty($result['externalId'])) {
                $message->channelMessageId = $result['externalId'];
            }
            $message->status = $result['status'] ?? 'sent';
            $message->save();
        } catch (Throwable $e) {
            Log::error('[Messaging] Envío externo falló: '.$e->getMessage(), [
                'channelType' => $conversation->channel?->type,
                'conversationId' => $conversation->id,
            ]);
            $message->status = 'failed';
            $message->save();
        }
    }

    private function driverFor(?Channel $channel): ?ChannelDriver
    {
        if (! $channel) {
            return null;
        }

        return match ($channel->type) {
            'messenger' => app(MessengerChannel::class),
            'whatsapp' => app(WhatsAppChannel::class),
            // 'instagram', 'sms' — se agregan en fases siguientes.
            default => null,
        };
    }

    private function buildHistory(Conversation $conversation): array
    {
        return Message::where('conversationId', $conversation->id)
            ->orderBy('id')
            ->get()
            ->map(fn (Message $m) => [
                'role' => $m->senderType === 'contact' ? 'contact' : ($m->senderType === 'bot' ? 'bot' : 'user'),
                'content' => (string) $m->content,
            ])
            ->all();
    }
}
