<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\TemplateZone;
use App\Models\ZoneInput;
use Illuminate\Http\Request;

class TemplateZoneController extends Controller
{
    use ApiResponse;

    public function byTemplate(int $templateId)
    {
        $zones = TemplateZone::with(['zoneInput.input:id,code,name,unitOfMeasure', 'zoneType:id,name,slug'])
            ->where('templateId', $templateId)->where('isActive', true)
            ->orderBy('sortOrder')->get();

        return $this->success($zones);
    }

    public function show(int $id)
    {
        $zone = TemplateZone::with(['zoneInput.input', 'zoneType'])->find($id);

        return $zone ? $this->success($zone) : $this->error('Zona no encontrada', 404);
    }

    public function store(Request $request, int $templateId)
    {
        $data = $request->validate([
            'zoneTypeId' => 'required|integer',
            'zoneId' => 'nullable|string',
            'name' => 'required|string',
            'description' => 'nullable|string',
            'shape' => 'nullable|string',
            'maxWidth' => 'nullable|integer',
            'maxHeight' => 'nullable|integer',
            'positionX' => 'nullable|integer',
            'positionY' => 'nullable|integer',
            'radius' => 'nullable|integer',
            'points' => 'nullable',
            'isEditable' => 'nullable|boolean',
            'isRequired' => 'nullable|boolean',
            'isBlocked' => 'nullable|boolean',
            'price' => 'nullable|numeric',
            'sortOrder' => 'nullable|integer',
        ]);

        $zone = TemplateZone::create([
            'templateId' => $templateId,
            'zoneTypeId' => $data['zoneTypeId'],
            'zoneId' => $data['zoneId'] ?? 'zone-'.uniqid(),
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'shape' => $data['shape'] ?? 'rect',
            'maxWidth' => $data['maxWidth'] ?? 0,
            'maxHeight' => $data['maxHeight'] ?? 0,
            'positionX' => $data['positionX'] ?? 0,
            'positionY' => $data['positionY'] ?? 0,
            'radius' => $data['radius'] ?? null,
            'points' => $data['points'] ?? null,
            'isEditable' => $data['isEditable'] ?? true,
            'isRequired' => $data['isRequired'] ?? false,
            'isBlocked' => $data['isBlocked'] ?? false,
            'price' => $data['price'] ?? 0,
            'sortOrder' => $data['sortOrder'] ?? 0,
            'isActive' => true,
        ]);

        return $this->created($zone, 'Zona creada exitosamente');
    }

    public function update(Request $request, int $id)
    {
        $zone = TemplateZone::find($id);
        if (! $zone) {
            return $this->error('Zona no encontrada', 404);
        }

        $data = $request->validate([
            'zoneTypeId' => 'nullable|integer',
            'zoneId' => 'nullable|string',
            'name' => 'nullable|string',
            'description' => 'nullable|string',
            'shape' => 'nullable|string',
            'maxWidth' => 'nullable|integer',
            'maxHeight' => 'nullable|integer',
            'positionX' => 'nullable|integer',
            'positionY' => 'nullable|integer',
            'radius' => 'nullable|integer',
            'points' => 'nullable',
            'isEditable' => 'nullable|boolean',
            'isRequired' => 'nullable|boolean',
            'isBlocked' => 'nullable|boolean',
            'price' => 'nullable|numeric',
            'sortOrder' => 'nullable|integer',
            'isActive' => 'nullable|boolean',
        ]);

        foreach ($data as $field => $value) {
            if ($request->has($field)) {
                $zone->{$field} = $value;
            }
        }
        $zone->save();

        return $this->success($zone, 'Zona actualizada');
    }

    public function destroy(Request $request, int $id)
    {
        $zone = TemplateZone::find($id);
        if (! $zone) {
            return $this->error('Zona no encontrada', 404);
        }

        if (filter_var($request->query('permanent'), FILTER_VALIDATE_BOOLEAN)) {
            $zone->delete();
        } else {
            $zone->isActive = false;
            $zone->save();
        }

        return $this->success($zone, 'Zona eliminada');
    }

    public function upsertInput(Request $request, int $zoneId)
    {
        $data = $request->validate([
            'inputId' => 'nullable|integer',
            'imageUrl' => 'required|string',
            'imageData' => 'nullable|string',
            'originalImageData' => 'nullable|string',
            'fileName' => 'nullable|string',
            'fileSize' => 'nullable|integer',
            'positionX' => 'nullable|integer',
            'positionY' => 'nullable|integer',
            'width' => 'nullable|integer',
            'height' => 'nullable|integer',
            'rotation' => 'nullable|numeric',
            'opacity' => 'nullable|numeric',
            'isLocked' => 'nullable|boolean',
        ]);

        $zoneInput = ZoneInput::updateOrCreate(
            ['templateZoneId' => $zoneId],
            [
                'inputId' => $data['inputId'] ?? null,
                'imageUrl' => $data['imageUrl'],
                'imageData' => $data['imageData'] ?? null,
                'originalImageData' => $data['originalImageData'] ?? null,
                'fileName' => $data['fileName'] ?? null,
                'fileSize' => $data['fileSize'] ?? null,
                'positionX' => $data['positionX'] ?? 0,
                'positionY' => $data['positionY'] ?? 0,
                'width' => $data['width'] ?? 100,
                'height' => $data['height'] ?? 100,
                'rotation' => $data['rotation'] ?? 0,
                'opacity' => $data['opacity'] ?? 1,
                'isLocked' => $data['isLocked'] ?? false,
            ]
        );

        return $this->success($zoneInput, 'Insumo asignado exitosamente');
    }

    public function deleteInput(int $zoneId)
    {
        ZoneInput::where('templateZoneId', $zoneId)->delete();

        return $this->success(null, 'Insumo eliminado de la zona');
    }
}
