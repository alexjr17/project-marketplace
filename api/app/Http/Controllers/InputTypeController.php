<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\InputType;
use App\Models\InputTypeSize;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class InputTypeController extends Controller
{
    use ApiResponse;

    private const WITH = ['inputTypeSizes.size'];

    public function index()
    {
        $types = InputType::with(self::WITH)->where('isActive', true)->orderBy('sortOrder')->get();

        return $this->success($types);
    }

    public function show(int $id)
    {
        $type = InputType::with(self::WITH)->find($id);

        return $type ? $this->success($type) : $this->error('Tipo de insumo no encontrado', 404);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'slug' => 'nullable|string',
            'description' => 'nullable|string',
            'sortOrder' => 'nullable|integer',
            'hasVariants' => 'nullable|boolean',
            'sizeIds' => 'nullable|array',
            'sizeIds.*' => 'integer',
        ]);

        $type = InputType::create([
            'name' => $data['name'],
            'slug' => $data['slug'] ?? Str::slug($data['name']),
            'description' => $data['description'] ?? null,
            'sortOrder' => $data['sortOrder'] ?? 0,
            'hasVariants' => $data['hasVariants'] ?? false,
            'isActive' => true,
        ]);

        foreach ($data['sizeIds'] ?? [] as $sizeId) {
            InputTypeSize::create(['inputTypeId' => $type->id, 'sizeId' => $sizeId]);
        }

        return $this->created($type->load(self::WITH), 'Tipo de insumo creado');
    }

    public function update(Request $request, int $id)
    {
        $type = InputType::find($id);
        if (! $type) {
            return $this->error('Tipo de insumo no encontrado', 404);
        }

        $data = $request->validate([
            'name' => 'nullable|string',
            'slug' => 'nullable|string',
            'description' => 'nullable|string',
            'sortOrder' => 'nullable|integer',
            'hasVariants' => 'nullable|boolean',
            'isActive' => 'nullable|boolean',
            'sizeIds' => 'nullable|array',
            'sizeIds.*' => 'integer',
        ]);

        if (array_key_exists('sizeIds', $data)) {
            InputTypeSize::where('inputTypeId', $id)->delete();
            foreach ($data['sizeIds'] ?? [] as $sizeId) {
                InputTypeSize::create(['inputTypeId' => $id, 'sizeId' => $sizeId]);
            }
            unset($data['sizeIds']);
        }

        $type->fill(array_filter($data, fn ($v) => $v !== null));
        $type->save();

        return $this->success($type->load(self::WITH), 'Tipo de insumo actualizado');
    }

    public function destroy(int $id)
    {
        $type = InputType::find($id);
        if (! $type) {
            return $this->error('Tipo de insumo no encontrado', 404);
        }
        $type->isActive = false;
        $type->save();

        return $this->success(null, 'Tipo de insumo eliminado');
    }
}
