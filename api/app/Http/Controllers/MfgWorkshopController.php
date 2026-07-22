<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgWorkshop;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Catálogo de talleres (internos y satélites) de la app Fábrica.
 */
class MfgWorkshopController extends Controller
{
    use ApiResponse;

    private function rules(int $ignoreId = 0): array
    {
        return [
            'name' => 'required|string|max:120',
            'code' => ['nullable', 'string', 'max:60', Rule::unique('mfg_workshops', 'code')->ignore($ignoreId)],
            'type' => 'nullable|in:INTERNAL,EXTERNAL',
            'contactName' => 'nullable|string|max:120',
            'phone' => 'nullable|string|max:40',
            'notes' => 'nullable|string',
            'isActive' => 'boolean',
            'processIds' => 'nullable|array',
            'processIds.*' => 'integer|exists:mfg_processes,id',
        ];
    }

    public function index()
    {
        return $this->success(MfgWorkshop::with('processes:id,name')->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->rules());
        $processIds = $data['processIds'] ?? null;
        unset($data['processIds']);
        $w = MfgWorkshop::create($data);
        if ($processIds !== null) {
            $w->processes()->sync($processIds);
        }

        return $this->created($w->load('processes:id,name'), 'Taller creado');
    }

    public function update(Request $request, int $id)
    {
        $w = MfgWorkshop::find($id);
        if (! $w) {
            return $this->error('Taller no encontrado', 404);
        }
        $data = $request->validate($this->rules($id));
        $processIds = $data['processIds'] ?? null;
        unset($data['processIds']);
        $w->fill($data)->save();
        if ($processIds !== null) {
            $w->processes()->sync($processIds);
        }

        return $this->success($w->load('processes:id,name'), 'Taller actualizado');
    }

    public function destroy(int $id)
    {
        $w = MfgWorkshop::find($id);
        if (! $w) {
            return $this->error('Taller no encontrado', 404);
        }
        $w->delete();

        return $this->success(null, 'Taller eliminado');
    }
}
