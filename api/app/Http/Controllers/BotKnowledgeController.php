<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\BotKnowledge;
use App\Services\Ai\AiAssistantService;
use Illuminate\Http\Request;

class BotKnowledgeController extends Controller
{
    use ApiResponse;

    public function index(Request $request)
    {
        $query = BotKnowledge::query()->orderBy('category')->orderBy('sortOrder')->orderBy('id');

        if ($request->filled('category')) {
            $query->where('category', $request->query('category'));
        }
        if ($request->filled('active')) {
            $query->where('isActive', filter_var($request->query('active'), FILTER_VALIDATE_BOOLEAN));
        }

        return $this->success($query->get()->map(fn ($k) => $this->format($k))->all());
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

        $k = new BotKnowledge;
        $k->category = $data['category'];
        $k->title = $data['title'];
        $k->content = $data['content'];
        $k->isActive = $data['isActive'] ?? true;
        $k->sortOrder = $data['sortOrder'] ?? 0;
        $k->save();

        return $this->created($this->format($k), 'Conocimiento agregado');
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

        foreach (['category', 'title', 'content', 'isActive', 'sortOrder'] as $f) {
            if (array_key_exists($f, $data)) {
                $k->{$f} = $data[$f];
            }
        }
        $k->save();

        return $this->success($this->format($k), 'Conocimiento actualizado');
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

    private function format(BotKnowledge $k): array
    {
        return [
            'id' => $k->id,
            'category' => $k->category,
            'title' => $k->title,
            'content' => $k->content,
            'isActive' => (bool) $k->isActive,
            'sortOrder' => (int) $k->sortOrder,
            'createdAt' => optional($k->createdAt)->toIso8601String(),
            'updatedAt' => optional($k->updatedAt)->toIso8601String(),
        ];
    }
}
