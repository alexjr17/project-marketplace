<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgProcess;
use App\Services\Manufacturing\MfgPlantCatalogService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Catálogo de estaciones / etapas de producción de la app Fábrica.
 */
class MfgProcessController extends Controller
{
    use ApiResponse;

    public function __construct(private MfgPlantCatalogService $catalogs) {}

    private function rules(int $ignoreId = 0): array
    {
        return [
            'name' => 'required|string|max:120',
            'code' => ['nullable', 'string', 'max:60', Rule::unique('mfg_processes', 'code')->ignore($ignoreId)],
            'sequence' => 'nullable|integer|min:0',
            'type' => 'nullable|in:INTERNAL,EXTERNAL',
            'isActive' => 'boolean',
            // Consumo: qué insumos consume el proceso (por tipo o insumo específico).
            'consumptions' => 'nullable|array',
            'consumptions.*.kind' => 'required|in:TYPE,INPUT',
            'consumptions.*.inputTypeId' => 'nullable|integer|exists:mfg_input_types,id',
            'consumptions.*.inputId' => 'nullable|integer|exists:mfg_inputs,id',
        ];
    }

    public function index()
    {
        return $this->success(
            MfgProcess::with(MfgPlantCatalogService::PROCESS_RELATIONS)->orderBy('sequence')->orderBy('id')->get()
        );
    }

    public function store(Request $request)
    {
        return $this->created($this->catalogs->saveProcess($request->validate($this->rules())), 'Proceso creado');
    }

    public function update(Request $request, int $id)
    {
        $p = MfgProcess::find($id);
        if (! $p) {
            return $this->error('Proceso no encontrado', 404);
        }

        return $this->success($this->catalogs->saveProcess($request->validate($this->rules($id)), $p), 'Proceso actualizado');
    }

    public function destroy(int $id)
    {
        $p = MfgProcess::find($id);
        if (! $p) {
            return $this->error('Proceso no encontrado', 404);
        }
        $p->delete();

        return $this->success(null, 'Proceso eliminado');
    }
}
