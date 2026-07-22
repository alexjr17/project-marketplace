<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgWarehouse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Catálogo de bodegas de la app Fábrica.
 */
class MfgWarehouseController extends Controller
{
    use ApiResponse;

    private function rules(int $ignoreId = 0): array
    {
        return [
            'name' => 'required|string|max:120',
            'code' => ['nullable', 'string', 'max:60', Rule::unique('mfg_warehouses', 'code')->ignore($ignoreId)],
            'address' => 'nullable|string|max:200',
            'isActive' => 'boolean',
        ];
    }

    public function index()
    {
        return $this->success(MfgWarehouse::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->rules());

        return $this->created(MfgWarehouse::create($data), 'Bodega creada');
    }

    public function update(Request $request, int $id)
    {
        $w = MfgWarehouse::find($id);
        if (! $w) {
            return $this->error('Bodega no encontrada', 404);
        }
        $w->fill($request->validate($this->rules($id)))->save();

        return $this->success($w, 'Bodega actualizada');
    }

    public function destroy(int $id)
    {
        $w = MfgWarehouse::find($id);
        if (! $w) {
            return $this->error('Bodega no encontrada', 404);
        }
        $w->delete();

        return $this->success(null, 'Bodega eliminada');
    }
}
