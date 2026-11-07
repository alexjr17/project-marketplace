<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\LabelTemplate;
use App\Models\LabelZone;
use App\Services\Settings\LabelTemplateService;
use Illuminate\Http\Request;

/** Plantillas de etiquetas y sus zonas. Valida y responde; las reglas están en LabelTemplateService. */
class LabelTemplateController extends Controller
{
    use ApiResponse;

    public function __construct(private LabelTemplateService $templates) {}

    /** GET /api/label-templates */
    public function index(Request $request)
    {
        $includeZones = filter_var($request->query('includeZones', 'true'), FILTER_VALIDATE_BOOLEAN);

        return $this->success($this->templates->listActive($includeZones));
    }

    /** GET /api/label-templates/{id} */
    public function show(int $id)
    {
        $template = $this->templates->find($id);

        return $template ? $this->success($template) : $this->error('Plantilla no encontrada', 404);
    }

    /** GET /api/label-templates/product-type/{productTypeId} */
    public function forProductType(int $productTypeId)
    {
        $template = $this->templates->forProductType($productTypeId);

        return $template ? $this->success($template) : $this->error('No se encontró plantilla por defecto', 404);
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

        return $this->created($this->templates->create($data));
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

        return $this->success($this->templates->update($template, $data));
    }

    /** DELETE /api/label-templates/{id} */
    public function destroy(int $id)
    {
        $template = LabelTemplate::find($id);
        if (! $template) {
            return $this->error('Plantilla no encontrada', 404);
        }
        $this->templates->delete($template);

        return $this->success(null, 'Plantilla eliminada');
    }

    /** POST /api/label-templates/{id}/duplicate */
    public function duplicate(Request $request, int $id)
    {
        $data = $request->validate(['name' => 'required|string']);

        $original = LabelTemplate::find($id);
        if (! $original) {
            return $this->error('Plantilla no encontrada', 404);
        }

        return $this->created($this->templates->duplicate($original, $data['name']));
    }

    /** POST /api/label-templates/{templateId}/zones */
    public function createZone(Request $request, int $templateId)
    {
        $data = $request->validate([
            'zoneType' => 'required|in:'.implode(',', LabelTemplateService::ZONE_TYPES),
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

        $template = LabelTemplate::find($templateId);
        if (! $template) {
            return $this->error('Plantilla no encontrada', 404);
        }

        return $this->created($this->templates->createZone($template, $data));
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

        $template = LabelTemplate::find($templateId);
        if (! $template) {
            return $this->error('Plantilla no encontrada', 404);
        }

        return $this->success($this->templates->updateZones($template, $payload['zones']));
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
