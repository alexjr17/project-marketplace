<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgGarmentType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Catálogo de tipos de prenda de la app Fábrica. El código prefija el de la referencia.
 */
class MfgGarmentTypeController extends Controller
{
    use ApiResponse;

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

    /** Reescribe las tallas del tipo por mercado. */
    private function syncSizes(MfgGarmentType $g, ?array $national, ?array $export): void
    {
        if ($national === null && $export === null) {
            return;
        }
        DB::table('mfg_garment_type_sizes')->where('garmentTypeId', $g->id)->delete();
        $rows = [];
        foreach (array_unique($national ?? []) as $sid) {
            $rows[] = ['garmentTypeId' => $g->id, 'sizeId' => $sid, 'market' => 'NATIONAL'];
        }
        foreach (array_unique($export ?? []) as $sid) {
            $rows[] = ['garmentTypeId' => $g->id, 'sizeId' => $sid, 'market' => 'EXPORT'];
        }
        if ($rows) {
            DB::table('mfg_garment_type_sizes')->insert($rows);
        }
    }

    private function normalize(array $data): array
    {
        $data['code'] = strtoupper(trim($data['code']));

        return $data;
    }

    public function index()
    {
        return $this->success(MfgGarmentType::with(['sizes:id,name,abbreviation,sortOrder', 'brand:id,name'])->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $data = $this->normalize($request->validate($this->rules()));
        [$national, $export] = [$data['nationalSizeIds'] ?? null, $data['exportSizeIds'] ?? null];
        unset($data['nationalSizeIds'], $data['exportSizeIds']);
        $g = MfgGarmentType::create($data);
        $this->syncSizes($g, $national, $export);

        return $this->created($g->load(['sizes:id,name,abbreviation,sortOrder', 'brand:id,name']), 'Tipo de prenda creado');
    }

    public function update(Request $request, int $id)
    {
        $g = MfgGarmentType::find($id);
        if (! $g) {
            return $this->error('Tipo de prenda no encontrado', 404);
        }
        $data = $this->normalize($request->validate($this->rules($id)));
        [$national, $export] = [$data['nationalSizeIds'] ?? null, $data['exportSizeIds'] ?? null];
        unset($data['nationalSizeIds'], $data['exportSizeIds']);
        $g->fill($data)->save();
        $this->syncSizes($g, $national, $export);

        return $this->success($g->load(['sizes:id,name,abbreviation,sortOrder', 'brand:id,name']), 'Tipo de prenda actualizado');
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
