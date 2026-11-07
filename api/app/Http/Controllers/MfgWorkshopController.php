<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgWorkshop;
use App\Services\Manufacturing\MfgPlantCatalogService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Catálogo de talleres (internos y satélites) de la app Fábrica.
 */
class MfgWorkshopController extends Controller
{
    use ApiResponse;

    public function __construct(private MfgPlantCatalogService $catalogs) {}

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
        return $this->created($this->catalogs->saveWorkshop($request->validate($this->rules())), 'Taller creado');
    }

    public function update(Request $request, int $id)
    {
        $w = MfgWorkshop::find($id);
        if (! $w) {
            return $this->error('Taller no encontrado', 404);
        }

        return $this->success($this->catalogs->saveWorkshop($request->validate($this->rules($id)), $w), 'Taller actualizado');
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
