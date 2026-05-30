<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\MessagingService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

/**
 * Bandeja de entrada del módulo de mensajería (admin):
 * lista conversaciones, ve detalle, marca como leída, cambia estado/asignación.
 */
class ConversationController extends Controller
{
    use ApiResponse;

    public function __construct(private MessagingService $messaging) {}

    private function fail(RuntimeException $e)
    {
        $status = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 400;

        return $this->error($e->getMessage(), $status);
    }

    public function index(Request $request)
    {
        $result = $this->messaging->listConversations($request->query());

        return response()->json(['success' => true] + $result);
    }

    public function show(int $id)
    {
        try {
            $conversation = $this->messaging->getConversation($id);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->success($this->messaging->formatConversation($conversation));
    }

    public function messages(int $id, Request $request)
    {
        try {
            $messages = $this->messaging->listMessages($id, $request->query('sinceId') !== null
                ? (int) $request->query('sinceId')
                : null);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->success($messages);
    }

    public function update(int $id, Request $request)
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in(['open', 'pending', 'resolved', 'closed'])],
            'assigneeUserId' => 'nullable|integer|exists:users,id',
            'aiEnabled' => 'nullable|boolean',
        ]);

        try {
            $conversation = $this->messaging->updateConversation($id, $data);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->success($this->messaging->formatConversation($conversation), 'Conversación actualizada');
    }

    public function markRead(int $id)
    {
        try {
            $conversation = $this->messaging->markRead($id);
        } catch (RuntimeException $e) {
            return $this->fail($e);
        }

        return $this->success($this->messaging->formatConversation($conversation));
    }
}
