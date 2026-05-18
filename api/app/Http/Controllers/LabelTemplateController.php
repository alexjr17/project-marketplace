<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\LabelTemplate;
use App\Models\LabelTemplateProductType;
use App\Models\LabelZone;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LabelTemplateController extends Controller
{
    use ApiResponse;

    private const ZONE_TYPES = [
        'PRODUCT_NAME', 'SIZE', 'COLOR', 'BARCODE',
        'BARCODE_TEXT', 'SKU', 'PRICE', 'CUSTOM_TEXT',
    ];

    /** Carga una plantilla con tipos de producto y zonas ordenadas por zIndex. */
    private function loadTemplate(int $id): ?LabelTemplate
    {
        return LabelTemplate::with([
            'productTypes.productType',
            'zones' => fn ($q) => $q->orderBy('zIndex'),
        ])->find($id);
    }

    /** GET /api/label-templates */
    public function index(Request $request)
    {
        $includeZones = filter_var($request->query('includeZones', 'true'), FILTER_VALIDATE_BOOLEAN);

        $with = ['productTypes.productType'];
        if ($includeZones) {
            $with['zones'] = fn ($q) => $q->orderBy('zIndex');
        }

        $templates = LabelTemplate::with($with)
            ->where('isActive', true)
            ->orderByDesc('isDefault')
            ->orderBy('name')
            ->get();

        return $this->success($templates);
    }

    /** GET /api/label-templates/{id} */
    public function show(int $id)
    {
        $template = $this->loadTemplate($id);
        if (! $template) {
            return $this->error('Plantilla no encontrada', 404);
        }

        return $this->success($template);
    }

    /** GET /api/label-templates/product-type/{productTypeId} */
    public function forProductType(int $productTypeId)
    {
        $specific = LabelTemplate::with(['productTypes.productType', 'zones' => fn ($q) => $q->orderBy('zIndex')])
            ->where('isActive', true)
            ->whereHas('productTypes', fn ($q) => $q->where('productTypeId', $productTypeId))
            ->first();

        if ($specific) {
            return $this->success($specific);
        }

        $default = LabelTemplate::with(['productTypes.productType', 'zones' => fn ($q) => $q->orderBy('zIndex')])
            ->where('isActive', true)->where('isDefault', true)->first();

        if (! $default) {
            return $this->error('No se encontró plantilla por defecto', 404);
        }

        return $this->success($default);
    }

    /** POST /api/label-templates */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'productTypeIds' => 'nullable|array',
            'productTypeIds.*' => 'integer',
            'backgroundImage' => 'nullable|string',
            'width' => 'nullable|numeric',
            'height' => 'nullable|numeric',
            'pageType' => 'nullable|string',
            'pageMargin' => 'nullable|numeric',
            'labelSpacing' => 'nullable|numeric',
            'isDefault' => 'nullable|boolean',
        ]);

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

            foreach ($data['productTypeIds'] ?? [] as $ptId) {
                LabelTemplateProductType::create([
                    'labelTemplateId' => $template->id,
                    'productTypeId' => $ptId,
                ]);
            }

            return $template;
        });

        return $this->created($this->loadTemplate($template->id));
    }

    /** PATCH /api/label-templates/{id} */
    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'name' => 'sometimes|string',
            'productTypeIds' => 'sometimes|array',
            'productTypeIds.*' => 'integer',
            'backgroundImage' => 'sometimes|nullable|string',
            'width' => 'sometimes|numeric',
            'height' => 'sometimes|numeric',
            'pageType' => 'sometimes|string',
            'pageMargin' => 'sometimes|numeric',
            'labelSpacing' => 'sometimes|numeric',
            'isDefault' => 'sometimes|boolean',
            'isActive' => 'sometimes|boolean',
        ]);

        $template = LabelTemplate::find($id);
        if (! $template) {
            return $this->error('Plantilla no encontrada', 404);
        }

        DB::transaction(function () use ($data, $id, $template) {
            if (! empty($data['isDefault'])) {
                LabelTemplate::where('isDefault', true)->where('id', '!=', $id)
                    ->update(['isDefault' => false]);
            }

            $fields = array_intersect_key($data, array_flip([
                'name', 'backgroundImage', 'width', 'height', 'pageType',
                'pageMargin', 'labelSpacing', 'isDefault', 'isActive',
            ]));
            if ($fields) {
                $template->fill($fields)->save();
            }

            if (array_key_exists('productTypeIds', $data)) {
                LabelTemplateProductType::where('labelTemplateId', $id)->delete();
                foreach ($data['productTypeIds'] as $ptId) {
                    LabelTemplateProductType::create([
                        'labelTemplateId' => $id,
                        'productTypeId' => $ptId,
                    ]);
                }
            }
        });

        return $this->success($this->loadTemplate($id));
    }

    /** DELETE /api/label-templates/{id} */
    public function destroy(int $id)
    {
        $template = LabelTemplate::find($id);
        if (! $template) {
            return $this->error('Plantilla no encontrada', 404);
        }

        if ($template->isDefault) {
            $others = LabelTemplate::where('id', '!=', $id)->where('isActive', true)->count();
            if ($others === 0) {
                return $this->error('No se puede eliminar la única plantilla por defecto', 400);
            }
        }

        $template->delete();

        return $this->success(null, 'Plantilla eliminada');
    }

    /** POST /api/label-templates/{id}/duplicate */
    public function duplicate(Request $request, int $id)
    {
        $data = $request->validate(['name' => 'required|string']);

        $original = LabelTemplate::with(['zones', 'productTypes'])->find($id);
        if (! $original) {
            return $this->error('Plantilla no encontrada', 404);
        }

        $copy = DB::transaction(function () use ($original, $data) {
            $copy = LabelTemplate::create([
                'name' => $data['name'],
                'backgroundImage' => $original->backgroundImage,
                'width' => $original->width,
                'height' => $original->height,
                'pageType' => $original->pageType,
                'pageMargin' => $original->pageMargin,
                'labelSpacing' => $original->labelSpacing,
                'isDefault' => false,
                'isActive' => true,
            ]);

            foreach ($original->productTypes as $pt) {
                LabelTemplateProductType::create([
                    'labelTemplateId' => $copy->id,
                    'productTypeId' => $pt->productTypeId,
                ]);
            }

            foreach ($original->zones as $zone) {
                LabelZone::create([
                    'labelTemplateId' => $copy->id,
                    'zoneType' => $zone->zoneType,
                    'x' => $zone->x, 'y' => $zone->y,
                    'width' => $zone->width, 'height' => $zone->height,
                    'fontSize' => $zone->fontSize,
                    'fontWeight' => $zone->fontWeight,
                    'textAlign' => $zone->textAlign,
                    'fontColor' => $zone->fontColor,
                    'showLabel' => $zone->showLabel,
                    'rotation' => $zone->rotation,
                    'zIndex' => $zone->zIndex,
                ]);
            }

            return $copy;
        });

        return $this->created($this->loadTemplate($copy->id));
    }

    /** POST /api/label-templates/{templateId}/zones */
    public function createZone(Request $request, int $templateId)
    {
        $data = $request->validate([
            'zoneType' => 'required|in:'.implode(',', self::ZONE_TYPES),
            'x' => 'required|numeric',
            'y' => 'required|numeric',
            'width' => 'required|numeric',
            'height' => 'required|numeric',
            'fontSize' => 'nullable|numeric',
            'fontWeight' => 'nullable|string',
            'textAlign' => 'nullable|string',
            'fontColor' => 'nullable|string',
            'showLabel' => 'nullable|boolean',
            'rotation' => 'nullable|numeric',
            'zIndex' => 'nullable|integer',
        ]);

        if (! LabelTemplate::where('id', $templateId)->exists()) {
            return $this->error('Plantilla no encontrada', 404);
        }

        $exists = LabelZone::where('labelTemplateId', $templateId)
            ->where('zoneType', $data['zoneType'])->exists();
        if ($exists) {
            return $this->error("Ya existe una zona de tipo {$data['zoneType']} en esta plantilla", 400);
        }

        $zone = LabelZone::create([
            'labelTemplateId' => $templateId,
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

        return $this->created($zone);
    }

    /** Campos editables de una zona. */
    private function zoneValidationRules(): array
    {
        return [
            'x' => 'sometimes|numeric',
            'y' => 'sometimes|numeric',
            'width' => 'sometimes|numeric',
            'height' => 'sometimes|numeric',
            'fontSize' => 'sometimes|numeric',
            'fontWeight' => 'sometimes|string',
            'textAlign' => 'sometimes|string',
            'fontColor' => 'sometimes|string',
            'showLabel' => 'sometimes|boolean',
            'rotation' => 'sometimes|numeric',
            'zIndex' => 'sometimes|integer',
        ];
    }

    /** PATCH /api/label-templates/zones/{zoneId} */
    public function updateZone(Request $request, int $zoneId)
    {
        $data = $request->validate($this->zoneValidationRules());

        $zone = LabelZone::find($zoneId);
        if (! $zone) {
            return $this->error('Zona no encontrada', 404);
        }

        $zone->fill($data)->save();

        return $this->success($zone);
    }

    /** PATCH /api/label-templates/{templateId}/zones/batch */
    public function updateZonesBatch(Request $request, int $templateId)
    {
        $payload = $request->validate([
            'zones' => 'required|array',
            'zones.*.id' => 'required|integer',
            'zones.*.data' => 'required|array',
        ]);

        if (! LabelTemplate::where('id', $templateId)->exists()) {
            return $this->error('Plantilla no encontrada', 404);
        }

        $allowed = array_keys($this->zoneValidationRules());
        $updated = [];
        foreach ($payload['zones'] as $entry) {
            $zone = LabelZone::where('id', $entry['id'])
                ->where('labelTemplateId', $templateId)->first();
            if (! $zone) {
                continue;
            }
            $zone->fill(array_intersect_key($entry['data'], array_flip($allowed)))->save();
            $updated[] = $zone;
        }

        return $this->success($updated);
    }

    /** DELETE /api/label-templates/zones/{zoneId} */
    public function deleteZone(int $zoneId)
    {
        $zone = LabelZone::find($zoneId);
        if (! $zone) {
            return $this->error('Zona no encontrada', 404);
        }

        $zone->delete();

        return $this->success(null, 'Zona eliminada');
    }
}
