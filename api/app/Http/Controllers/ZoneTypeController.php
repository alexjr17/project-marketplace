<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\ZoneType;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ZoneTypeController extends Controller
{
    use ApiResponse;

    public function index()
    {
        return $this->success(ZoneType::orderBy('sortOrder')->get());
    }

    public function show(int $id)
    {
        $zoneType = ZoneType::find($id);

        return $zoneType ? $this->success($zoneType) : $this->error('Tipo de zona no encontrado', 404);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'slug' => 'nullable|string',
            'description' => 'nullable|string',
            'sortOrder' => 'nullable|integer',
        ]);

        $zoneType = ZoneType::create([
            'name' => $data['name'],
            'slug' => $data['slug'] ?? Str::slug($data['name']),
            'description' => $data['description'] ?? null,
            'sortOrder' => $data['sortOrder'] ?? 0,
            'isActive' => true,
        ]);

        return $this->created($zoneType);
    }

    public function update(Request $request, int $id)
    {
        $zoneType = ZoneType::find($id);
        if (! $zoneType) {
            return $this->error('Tipo de zona no encontrado', 404);
        }

        $data = $request->validate([
            'name' => 'nullable|string',
            'slug' => 'nullable|string',
            'description' => 'nullable|string',
            'sortOrder' => 'nullable|integer',
            'isActive' => 'nullable|boolean',
        ]);

        $zoneType->fill(array_filter($data, fn ($v) => $v !== null));
        $zoneType->save();

        return $this->success($zoneType);
    }

    public function destroy(Request $request, int $id)
    {
        $zoneType = ZoneType::find($id);
        if (! $zoneType) {
            return $this->error('Tipo de zona no encontrado', 404);
        }

        if (filter_var($request->query('permanent'), FILTER_VALIDATE_BOOLEAN)) {
            $zoneType->delete();
        } else {
            $zoneType->isActive = false;
            $zoneType->save();
        }

        return $this->success($zoneType);
    }
}
