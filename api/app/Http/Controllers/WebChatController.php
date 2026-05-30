<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\MessagingService;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Endpoints públicos para el widget de chat web embebido en la tienda.
 *
 * El widget llama primero a `start` para crear (o reabrir) una conversación
 * y recibir un token de sesión. Después usa ese token para enviar mensajes
 * (`send`) y traer mensajes nuevos (`poll`).
 *
 * El token va en el header  X-WebChat-Token  para no exponerlo en la URL.
 */
class WebChatController extends Controller
{
    use ApiResponse;

    public function __construct(private MessagingService $messaging) {}

    private function fail(RuntimeException $e)
    {
        $status = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 400;

        return $this->error($e->getMessage(), $status);
    }

    /** Crea o reabre una conversación para el visitante. */
    public function start(Request $request)
    {
        $data = $request->validate([
            'name' => 'nullable|string|max:120',
            'email' => 'nullable|email|max:160',
            'phone' => 'nullable|string|max:50',
        ]);

        $data['userId'] = $request->user()?->id;

        try {
            $session = $this->messaging->startWebChat($data);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->created($session, 'Conversación iniciada');
    }

    /** Mensaje entrante desde el visitante. Puede disparar autorespuesta IA. */
    public function send(Request $request)
    {
        $data = $request->validate([
            'content' => 'required|string|max:5000',
        ]);

        try {
            $conversation = $this->authenticate($request);
            $result = $this->messaging->receiveInboundMessage($conversation, $data['content']);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->created($result, 'Mensaje enviado');
    }

    /** Devuelve los mensajes posteriores al sinceId que envíe el cliente. */
    public function poll(Request $request)
    {
        try {
            $conversation = $this->authenticate($request);
            $sinceId = $request->query('sinceId') !== null ? (int) $request->query('sinceId') : null;
            $messages = $this->messaging->listMessages($conversation->id, $sinceId);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->success([
            'conversationId' => $conversation->id,
            'messages' => $messages,
        ]);
    }

    private function authenticate(Request $request)
    {
        $token = $request->header('X-WebChat-Token') ?: (string) $request->input('sessionToken');
        if (! $token) {
            throw new RuntimeException('Sesión de chat no provista', 401);
        }

        return $this->messaging->authenticateWebSession($token);
    }
}
