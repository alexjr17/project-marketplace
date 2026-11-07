<?php

namespace App\Services\Messaging;

use App\Exceptions\BusinessRuleException;
use App\Models\BotKnowledge;
use App\Models\BotKnowledgeCategory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Base de conocimiento del bot (Entrenar IA): categorías con slug único y sus entradas.
 * Las entradas apuntan a la categoría por slug, así que renombrarlo mueve las entradas.
 */
class BotKnowledgeService
{
    private const CATEGORY_FIELDS = ['label', 'description', 'emoji', 'color', 'sortOrder', 'isActive'];

    private const ENTRY_FIELDS = ['category', 'title', 'content', 'isActive', 'sortOrder'];

    // ==================== Categorías ====================

    /** @return array<int, array> */
    public function categories(?bool $active): array
    {
        $categories = BotKnowledgeCategory::orderBy('sortOrder')->orderBy('id')
            ->when($active !== null, fn ($q) => $q->where('isActive', $active))
            ->get();
        // Conteo de entradas por categoría en una sola consulta.
        $counts = BotKnowledge::whereIn('category', $categories->pluck('slug'))
            ->groupBy('category')->selectRaw('category, COUNT(*) as total')->pluck('total', 'category');

        return $categories->map(fn ($c) => $this->formatCategory($c, (int) ($counts[$c->slug] ?? 0)))->all();
    }

    /** Crea la categoría; sin slug se genera desde el nombre (con sufijo si ya existe). */
    public function createCategory(array $data): BotKnowledgeCategory
    {
        $slug = $data['slug'] ?? Str::slug($data['label'], '_');
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

        return $c;
    }

    /** Actualiza la categoría; si cambia el slug, sus entradas pasan al slug nuevo (todo o nada). */
    public function updateCategory(BotKnowledgeCategory $c, array $data): BotKnowledgeCategory
    {
        $newSlug = $data['slug'] ?? null;
        $renames = $newSlug !== null && $newSlug !== $c->slug;
        if ($renames && BotKnowledgeCategory::where('slug', $newSlug)->where('id', '!=', $c->id)->exists()) {
            throw new BusinessRuleException('Ya existe otra categoría con ese slug');
        }

        DB::transaction(function () use ($c, $data, $renames, $newSlug) {
            if ($renames) {
                BotKnowledge::where('category', $c->slug)->update(['category' => $newSlug]);
                $c->slug = $newSlug;
            }
            foreach (self::CATEGORY_FIELDS as $f) {
                if (array_key_exists($f, $data)) {
                    $c->{$f} = $data[$f];
                }
            }
            $c->save();
        });

        return $c;
    }

    /** Solo se borra vacía: el admin decide qué hacer con sus entradas. */
    public function deleteCategory(BotKnowledgeCategory $c): void
    {
        $count = $this->entriesCount($c);
        if ($count > 0) {
            throw new BusinessRuleException("No se puede eliminar: hay {$count} entradas en esta categoría. Muévelas o elimínalas primero.");
        }
        $c->delete();
    }

    public function entriesCount(BotKnowledgeCategory $c): int
    {
        return BotKnowledge::where('category', $c->slug)->count();
    }

    public function formatCategory(BotKnowledgeCategory $c, ?int $entriesCount = null): array
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
            'entriesCount' => $entriesCount ?? $this->entriesCount($c),
            'createdAt' => optional($c->createdAt)->toIso8601String(),
            'updatedAt' => optional($c->updatedAt)->toIso8601String(),
        ];
    }

    // ==================== Entradas ====================

    /** Crea o actualiza una entrada con los campos que vengan (nueva: activa y orden 0 por defecto). */
    public function saveEntry(array $data, ?BotKnowledge $k = null): BotKnowledge
    {
        if (! $k) {
            $k = new BotKnowledge;
            $k->isActive = true;
            $k->sortOrder = 0;
        }
        foreach (self::ENTRY_FIELDS as $f) {
            // En una entrada nueva, un valor vacío deja el valor por defecto.
            if (array_key_exists($f, $data) && ($k->exists || $data[$f] !== null)) {
                $k->{$f} = $data[$f];
            }
        }
        $k->save();

        return $k;
    }

    public function formatEntry(BotKnowledge $k): array
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
