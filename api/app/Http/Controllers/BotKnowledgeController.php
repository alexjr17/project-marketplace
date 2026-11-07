<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\BotKnowledge;
use App\Services\Ai\AiAssistantService;
use App\Services\Messaging\BotKnowledgeService;
use Illuminate\Http\Request;

/** Entradas de la base de conocimiento del bot y la prueba de respuesta. */
class BotKnowledgeController extends Controller
{
    use ApiResponse;

    public function __construct(private BotKnowledgeService $knowledge) {}

    public function index(Request $request)
    {
        $entries = BotKnowledge::query()
            ->when($request->filled('category'), fn ($q) => $q->where('category', $request->query('category')))
            ->when($request->filled('active'), fn ($q) => $q->where('isActive', filter_var($request->query('active'), FILTER_VALIDATE_BOOLEAN)))
            ->orderBy('category')->orderBy('sortOrder')->orderBy('id')
            ->get();

        return $this->success($entries->map(fn ($k) => $this->knowledge->formatEntry($k))->all());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'category' => 'required|string|exists:bot_knowledge_categories,slug',
            'title' => 'required|string|max:200',
            'content' => 'required|string|max:5000',
            'isActive' => 'nullable|boolean',
            'sortOrder' => 'nullable|integer|min:0',
        ]);

        return $this->created($this->knowledge->formatEntry($this->knowledge->saveEntry($data)), 'Conocimiento agregado');
    }

    public function update(int $id, Request $request)
    {
        $k = BotKnowledge::find($id);
        if (! $k) {
            return $this->error('Entrada no encontrada', 404);
        }

        $data = $request->validate([
            'category' => 'nullable|string|exists:bot_knowledge_categories,slug',
            'title' => 'nullable|string|max:200',
            'content' => 'nullable|string|max:5000',
            'isActive' => 'nullable|boolean',
            'sortOrder' => 'nullable|integer|min:0',
        ]);

        return $this->success($this->knowledge->formatEntry($this->knowledge->saveEntry($data, $k)), 'Conocimiento actualizado');
    }

    public function destroy(int $id)
    {
        $k = BotKnowledge::find($id);
        if (! $k) {
            return $this->error('Entrada no encontrada', 404);
        }
        $k->delete();

        return $this->success(null, 'Entrada eliminada');
    }

    /** Endpoint de prueba: dado un texto del cliente, devuelve la respuesta del bot. */
    public function test(Request $request, AiAssistantService $ai)
    {
        $data = $request->validate([
            'text' => 'required|string|max:2000',
            'contactName' => 'nullable|string|max:120',
        ]);

        $reply = $ai->suggestReply(
            [['role' => 'contact', 'content' => $data['text']]],
            ['contactName' => $data['contactName'] ?? '']
        );

        return $this->success([
            'provider' => $ai->providerName(),
            'reply' => $reply,
        ]);
    }
}
