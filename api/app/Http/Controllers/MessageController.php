<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\MessagingService;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Envío de mensajes salientes por parte de un operador, más el endpoint
 * "sugerir respuesta" que llama al asistente de IA.
 */
class MessageController extends Controller
{
    use ApiResponse;

    public function __construct(private MessagingService $messaging) {}

    private function fail(RuntimeException $e)
    {
        $status = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 400;

        return $this->error($e->getMessage(), $status);
    }

    public function store(int $conversationId, Request $request)
    {
        $data = $request->validate([
            'content' => 'required|string|max:5000',
        ]);

        try {
            $conversation = $this->messaging->getConversation($conversationId);
            $message = $this->messaging->sendOperatorMessage(
                $conversation,
                $request->user()->id,
                $data['content']
            );
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->created($this->messaging->formatMessage($message), 'Mensaje enviado');
    }

    public function suggest(int $conversationId)
    {
        try {
            $conversation = $this->messaging->getConversation($conversationId);
            $suggestion = $this->messaging->suggestReply($conversation);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->success(['suggestion' => $suggestion]);
    }
}
