<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgGarmentType;
use App\Services\Manufacturing\MfgPlantCatalogService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Catálogo de tipos de prenda de la app Fábrica. El código prefija el de la referencia.
 */
class MfgGarmentTypeController extends Controller
{
    use ApiResponse;

    public function __construct(private MfgPlantCatalogService $catalogs) {}

    private function rules(int $ignoreId = 0): array
    {
        return [
            'code' => ['required', 'string', 'max:10', Rule::unique('mfg_garment_types', 'code')->ignore($ignoreId)],
            'name' => 'required|string|max:120',
            'composition' => 'nullable|in:SUPERIOR,INFERIOR,SET',
            'brandId' => 'nullable|integer|exists:mfg_brands,id',
            'fixedCost' => 'nullable|numeric|min:0',
            'factor' => 'nullable|numeric|min:0',
            'factorExport' => 'nullable|numeric|min:0',
            'isActive' => 'boolean',
            'nationalSizeIds' => 'nullable|array',
            'nationalSizeIds.*' => 'integer|exists:mfg_sizes,id',
            'exportSizeIds' => 'nullable|array',
            'exportSizeIds.*' => 'integer|exists:mfg_sizes,id',
        ];
    }

    public function index()
    {
        return $this->success(MfgGarmentType::with(MfgPlantCatalogService::GARMENT_TYPE_RELATIONS)->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        return $this->created($this->catalogs->saveGarmentType($request->validate($this->rules())), 'Tipo de prenda creado');
    }

    public function update(Request $request, int $id)
    {
        $g = MfgGarmentType::find($id);
        if (! $g) {
            return $this->error('Tipo de prenda no encontrado', 404);
        }

        return $this->success($this->catalogs->saveGarmentType($request->validate($this->rules($id)), $g), 'Tipo de prenda actualizado');
    }

    public function destroy(int $id)
    {
        $g = MfgGarmentType::find($id);
        if (! $g) {
            return $this->error('Tipo de prenda no encontrado', 404);
        }
        $g->delete();

        return $this->success(null, 'Tipo de prenda eliminado');
    }
}
