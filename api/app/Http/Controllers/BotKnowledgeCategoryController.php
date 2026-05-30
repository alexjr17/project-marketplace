<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\BotKnowledge;
use App\Models\BotKnowledgeCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class BotKnowledgeCategoryController extends Controller
{
    use ApiResponse;

    public function index(Request $request)
    {
        $query = BotKnowledgeCategory::orderBy('sortOrder')->orderBy('id');
        if ($request->filled('active')) {
            $query->where('isActive', filter_var($request->query('active'), FILTER_VALIDATE_BOOLEAN));
        }

        return $this->success($query->get()->map(fn ($c) => $this->format($c))->all());
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

        $slug = $data['slug'] ?? Str::slug($data['label'], '_');
        // Si el slug auto-generado choca, agregar sufijo numérico.
        $base = $slug;
        $n = 1;
        while (BotKnowledgeCategory::where('slug', $slug)->exists()) {
            $slug = $base.'_'.(++$n);
        }

        $c = new BotKnowledgeCategory;
        $c->slug = $slug;
        $c->label = $data['label'];
        $c->description = $data['description'] ?? null;
        $c->emoji = $data['emoji'] ?? null;
        $c->color = $data['color'] ?? null;
        $c->sortOrder = $data['sortOrder'] ?? (BotKnowledgeCategory::max('sortOrder') ?? 0) + 1;
        $c->isActive = $data['isActive'] ?? true;
        $c->save();

        return $this->created($this->format($c), 'Categoría creada');
    }

    public function update(int $id, Request $request)
    {
        $c = BotKnowledgeCategory::find($id);
        if (! $c) {
            return $this->error('Categoría no encontrada', 404);
        }

        $data = $request->validate([
            // Permitimos editar el slug pero validamos colisión.
            'slug' => 'nullable|string|max:50|alpha_dash',
            'label' => 'nullable|string|max:120',
            'description' => 'nullable|string|max:250',
            'emoji' => 'nullable|string|max:10',
            'color' => 'nullable|string|max:30',
            'sortOrder' => 'nullable|integer|min:0',
            'isActive' => 'nullable|boolean',
        ]);

        // Si cambia el slug, actualizar también la columna `category` en bot_knowledge
        // de todas las entradas que apuntan al slug viejo.
        $oldSlug = $c->slug;
        if (array_key_exists('slug', $data) && $data['slug'] !== null && $data['slug'] !== $oldSlug) {
            if (BotKnowledgeCategory::where('slug', $data['slug'])->where('id', '!=', $c->id)->exists()) {
                return $this->error('Ya existe otra categoría con ese slug', 422);
            }
            BotKnowledge::where('category', $oldSlug)->update(['category' => $data['slug']]);
            $c->slug = $data['slug'];
        }

        foreach (['label', 'description', 'emoji', 'color', 'sortOrder', 'isActive'] as $f) {
            if (array_key_exists($f, $data)) {
                $c->{$f} = $data[$f];
            }
        }
        $c->save();

        return $this->success($this->format($c), 'Categoría actualizada');
    }

    public function destroy(int $id)
    {
        $c = BotKnowledgeCategory::find($id);
        if (! $c) {
            return $this->error('Categoría no encontrada', 404);
        }

        // Bloqueamos si tiene entradas: el admin decide qué hacer con ellas.
        $count = BotKnowledge::where('category', $c->slug)->count();
        if ($count > 0) {
            return $this->error(
                "No se puede eliminar: hay {$count} entradas en esta categoría. Muévelas o elimínalas primero.",
                422
            );
        }

        $c->delete();

        return $this->success(null, 'Categoría eliminada');
    }

    private function format(BotKnowledgeCategory $c): array
    {
        return [
            'id' => $c->id,
            'slug' => $c->slug,
            'label' => $c->label,
            'description' => $c->description,
            'emoji' => $c->emoji,
            'color' => $c->color,
            'sortOrder' => (int) $c->sortOrder,
            'isActive' => (bool) $c->isActive,
            // Conteo dinámico de entradas en esa categoría (cómodo para la UI).
            'entriesCount' => BotKnowledge::where('category', $c->slug)->count(),
            'createdAt' => optional($c->createdAt)->toIso8601String(),
            'updatedAt' => optional($c->updatedAt)->toIso8601String(),
        ];
    }
}
