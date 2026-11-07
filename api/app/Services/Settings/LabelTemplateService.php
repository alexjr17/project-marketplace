<?php

namespace App\Services\Settings;

use App\Exceptions\BusinessRuleException;
use App\Models\LabelTemplate;
use App\Models\LabelTemplateProductType;
use App\Models\LabelZone;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Plantillas de etiquetas (código de barras) y sus zonas: una sola plantilla por defecto,
 * tipos de producto asociados, duplicado y edición de zonas.
 */
class LabelTemplateService
{
    public const ZONE_TYPES = [
        'PRODUCT_NAME', 'SIZE', 'COLOR', 'BARCODE',
        'BARCODE_TEXT', 'SKU', 'PRICE', 'CUSTOM_TEXT',
    ];

    /** Campos de una zona que se pueden editar. */
    public const ZONE_FIELDS = [
        'x', 'y', 'width', 'height', 'fontSize', 'fontWeight',
        'textAlign', 'fontColor', 'showLabel', 'rotation', 'zIndex',
    ];

    private const TEMPLATE_FIELDS = [
        'name', 'backgroundImage', 'width', 'height', 'pageType',
        'pageMargin', 'labelSpacing', 'isDefault', 'isActive',
    ];

    /** Plantilla con tipos de producto y zonas ordenadas por zIndex. */
    public function find(int $id): ?LabelTemplate
    {
        return $this->withRelations(LabelTemplate::query())->find($id);
    }

    public function listActive(bool $includeZones = true): Collection
    {
        $with = ['productTypes.productType'];
        if ($includeZones) {
            $with['zones'] = fn ($q) => $q->orderBy('zIndex');
        }

        return LabelTemplate::with($with)
            ->where('isActive', true)
            ->orderByDesc('isDefault')
            ->orderBy('name')
            ->get();
    }

    /** La plantilla activa del tipo de producto; si no hay, la plantilla por defecto. */
    public function forProductType(int $productTypeId): ?LabelTemplate
    {
        return $this->withRelations(LabelTemplate::query())->where('isActive', true)
            ->whereHas('productTypes', fn ($q) => $q->where('productTypeId', $productTypeId))
            ->first()
            ?? $this->withRelations(LabelTemplate::query())->where('isActive', true)->where('isDefault', true)->first();
    }

    public function create(array $data): LabelTemplate
    {
        $template = DB::transaction(function () use ($data) {
            if (! empty($data['isDefault'])) {
                LabelTemplate::where('isDefault', true)->update(['isDefault' => false]);
            }

            $template = LabelTemplate::create([
                'name' => $data['name'],
                'backgroundImage' => $data['backgroundImage'] ?? null,
                'width' => $data['width'] ?? 170.08,
                'height' => $data['height'] ?? 255.12,
                'pageType' => $data['pageType'] ?? 'A4',
                'pageMargin' => $data['pageMargin'] ?? 20,
                'labelSpacing' => $data['labelSpacing'] ?? 5.67,
                'isDefault' => $data['isDefault'] ?? false,
                'isActive' => true,
            ]);
            $this->attachProductTypes($template->id, $data['productTypeIds'] ?? []);

            return $template;
        });

        return $this->find($template->id);
    }

    public function update(LabelTemplate $template, array $data): LabelTemplate
    {
        DB::transaction(function () use ($template, $data) {
            if (! empty($data['isDefault'])) {
                LabelTemplate::where('isDefault', true)->where('id', '!=', $template->id)->update(['isDefault' => false]);
            }

            $fields = array_intersect_key($data, array_flip(self::TEMPLATE_FIELDS));
            if ($fields) {
                $template->fill($fields)->save();
            }

            if (array_key_exists('productTypeIds', $data)) {
                LabelTemplateProductType::where('labelTemplateId', $template->id)->delete();
                $this->attachProductTypes($template->id, $data['productTypeIds']);
            }
        });

        return $this->find($template->id);
    }

    public function delete(LabelTemplate $template): void
    {
        if ($template->isDefault
            && LabelTemplate::where('id', '!=', $template->id)->where('isActive', true)->doesntExist()) {
            throw new BusinessRuleException('No se puede eliminar la única plantilla por defecto', 400);
        }
        $template->delete();
    }

    /** Copia la plantilla con sus tipos de producto y zonas; la copia nunca es la de por defecto. */
    public function duplicate(LabelTemplate $original, string $name): LabelTemplate
    {
        $original->loadMissing(['zones', 'productTypes']);

        $copy = DB::transaction(function () use ($original, $name) {
            $copy = LabelTemplate::create([
                'name' => $name,
                'backgroundImage' => $original->backgroundImage,
                'width' => $original->width,
                'height' => $original->height,
                'pageType' => $original->pageType,
                'pageMargin' => $original->pageMargin,
                'labelSpacing' => $original->labelSpacing,
                'isDefault' => false,
                'isActive' => true,
            ]);
            $this->attachProductTypes($copy->id, $original->productTypes->pluck('productTypeId')->all());

            foreach ($original->zones as $zone) {
                LabelZone::create(['labelTemplateId' => $copy->id, 'zoneType' => $zone->zoneType]
                    + $zone->only(self::ZONE_FIELDS));
            }

            return $copy;
        });

        return $this->find($copy->id);
    }

    /** Agrega una zona; cada tipo de zona va una sola vez por plantilla. */
    public function createZone(LabelTemplate $template, array $data): LabelZone
    {
        if (LabelZone::where('labelTemplateId', $template->id)->where('zoneType', $data['zoneType'])->exists()) {
            throw new BusinessRuleException("Ya existe una zona de tipo {$data['zoneType']} en esta plantilla", 400);
        }

        return LabelZone::create([
            'labelTemplateId' => $template->id,
            'zoneType' => $data['zoneType'],
            'x' => $data['x'], 'y' => $data['y'],
            'width' => $data['width'], 'height' => $data['height'],
            'fontSize' => $data['fontSize'] ?? 10,
            'fontWeight' => $data['fontWeight'] ?? 'normal',
            'textAlign' => $data['textAlign'] ?? 'center',
            'fontColor' => $data['fontColor'] ?? '#000000',
            'showLabel' => $data['showLabel'] ?? true,
            'rotation' => $data['rotation'] ?? 0,
            'zIndex' => $data['zIndex'] ?? 0,
        ]);
    }

    /**
     * Edita varias zonas de la plantilla a la vez (todo o nada). Las zonas que no son de la
     * plantilla se ignoran.
     *
     * @param  array<int, array{id:int, data:array}>  $entries
     * @return LabelZone[]
     */
    public function updateZones(LabelTemplate $template, array $entries): array
    {
        return DB::transaction(function () use ($template, $entries) {
            $updated = [];
            foreach ($entries as $entry) {
                $zone = LabelZone::where('id', $entry['id'])->where('labelTemplateId', $template->id)->first();
                if (! $zone) {
                    continue;
                }
                $zone->fill(array_intersect_key($entry['data'], array_flip(self::ZONE_FIELDS)))->save();
                $updated[] = $zone;
            }

            return $updated;
        });
    }

    private function attachProductTypes(int $templateId, array $productTypeIds): void
    {
        foreach ($productTypeIds as $ptId) {
            LabelTemplateProductType::create(['labelTemplateId' => $templateId, 'productTypeId' => $ptId]);
        }
    }

    private function withRelations($query)
    {
        return $query->with(['productTypes.productType', 'zones' => fn ($q) => $q->orderBy('zIndex')]);
    }
}
