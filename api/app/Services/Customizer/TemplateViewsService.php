<?php

namespace App\Services\Customizer;

use App\Exceptions\BusinessRuleException;
use App\Models\Product;
use App\Models\TemplateZone;
use Illuminate\Support\Facades\DB;

/**
 * Pasar una plantilla personalizable a fotos usando las de otra: copia la foto de cada vista (frente,
 * espalda, mangas…) y acomoda cada zona sobre esas fotos con la zona del mismo tipo de la otra
 * plantilla (la más grande de ese tipo). Los precios, nombres y reglas de las zonas no cambian. La
 * plantilla queda sin 3D (editor con fotos).
 */
class TemplateViewsService
{
    /** @return array{views: int, zones: int} */
    public function copyFrom(int $targetId, int $sourceId): array
    {
        if ($targetId === $sourceId) {
            throw new BusinessRuleException('Elige otra plantilla', 422);
        }
        $target = Product::where('isTemplate', true)->find($targetId) ?? throw new BusinessRuleException('Plantilla no encontrada', 404);
        $source = Product::where('isTemplate', true)->find($sourceId) ?? throw new BusinessRuleException('Plantilla de origen no encontrada', 404);
        $images = array_filter((array) ($source->zoneTypeImages ?? []), fn ($v) => is_string($v) && $v !== '');
        if (! $images) {
            throw new BusinessRuleException('Esa plantilla no tiene fotos de sus vistas', 422);
        }

        // Por tipo de zona, la zona más grande de la plantilla de origen.
        $bySlug = [];
        foreach (TemplateZone::where('templateId', $source->id)->get() as $z) {
            $area = (float) $z->maxWidth * (float) $z->maxHeight;
            if (! isset($bySlug[$z->zoneTypeId]) || $area > $bySlug[$z->zoneTypeId]['area']) {
                $bySlug[$z->zoneTypeId] = ['area' => $area, 'zone' => $z];
            }
        }

        $moved = 0;
        DB::transaction(function () use ($target, $images, $bySlug, &$moved) {
            $target->zoneTypeImages = $images;
            $target->model3d = null;
            $target->save();
            foreach (TemplateZone::where('templateId', $target->id)->get() as $z) {
                $src = $bySlug[$z->zoneTypeId]['zone'] ?? null;
                if (! $src) {
                    continue;
                }
                $z->fill([
                    'positionX' => $src->positionX, 'positionY' => $src->positionY,
                    'maxWidth' => $src->maxWidth, 'maxHeight' => $src->maxHeight,
                    'shape' => $src->shape, 'points' => $src->points, 'radius' => $src->radius,
                ]);
                $z->save();
                $moved++;
            }
        });

        return ['views' => count($images), 'zones' => $moved];
    }
}
