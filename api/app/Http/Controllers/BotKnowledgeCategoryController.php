<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\BotKnowledgeCategory;
use App\Services\Messaging\BotKnowledgeService;
use Illuminate\Http\Request;

/** Categorías de la base de conocimiento del bot. Las reglas están en BotKnowledgeService. */
class BotKnowledgeCategoryController extends Controller
{
    use ApiResponse;

    public function __construct(private BotKnowledgeService $knowledge) {}

    public function index(Request $request)
    {
        $active = $request->filled('active') ? filter_var($request->query('active'), FILTER_VALIDATE_BOOLEAN) : null;

        return $this->success($this->knowledge->categories($active));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'slug' => 'nullable|string|max:50|alpha_dash|unique:bot_knowledge_categories,slug',
            'label' => 'required|string|max:120',
            'description' => 'nullable|string|max:250',
            'emoji' => 'nullable|string|max:10',
            'color' => 'nullable|string|max:30',
            'sortOrder' => 'nullable|integer|min:0',
            'isActive' => 'nullable|boolean',
        ]);

        return $this->created($this->knowledge->formatCategory($this->knowledge->createCategory($data)), 'Categoría creada');
    }

    public function update(int $id, Request $request)
    {
        $c = BotKnowledgeCategory::find($id);
        if (! $c) {
            return $this->error('Categoría no encontrada', 404);
        }

        $data = $request->validate([
            // El slug se puede editar; la colisión la valida el servicio.
            'slug' => 'nullable|string|max:50|alpha_dash',
            'label' => 'nullable|string|max:120',
            'description' => 'nullable|string|max:250',
            'emoji' => 'nullable|string|max:10',
            'color' => 'nullable|string|max:30',
            'sortOrder' => 'nullable|integer|min:0',
            'isActive' => 'nullable|boolean',
        ]);

        return $this->success($this->knowledge->formatCategory($this->knowledge->updateCategory($c, $data)), 'Categoría actualizada');
    }

    public function destroy(int $id)
    {
        $c = BotKnowledgeCategory::find($id);
        if (! $c) {
            return $this->error('Categoría no encontrada', 404);
        }
        $this->knowledge->deleteCategory($c);

        return $this->success(null, 'Categoría eliminada');
    }
}
