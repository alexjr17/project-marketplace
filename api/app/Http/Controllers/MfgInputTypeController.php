<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgInputType;
use Illuminate\Http\Request;

/**
 * Catálogo de tipos de insumo (clasificación Producto/Servicio) de la app Fábrica.
 */
class MfgInputTypeController extends Controller
{
    use ApiResponse;

    private function rules(): array
    {
        return [
            'name' => 'required|string|max:120',
            'classification' => 'nullable|in:PRODUCTO,SERVICIO',
            'consumesByColor' => 'boolean',
            'description' => 'nullable|string',
            'isActive' => 'boolean',
        ];
    }

    public function index()
    {
        return $this->success(MfgInputType::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        return $this->created(MfgInputType::create($request->validate($this->rules())), 'Tipo de insumo creado');
    }

    public function update(Request $request, int $id)
    {
        $t = MfgInputType::find($id);
        if (! $t) {
            return $this->error('Tipo de insumo no encontrado', 404);
        }
        $t->fill($request->validate($this->rules()))->save();

        return $this->success($t, 'Tipo de insumo actualizado');
    }

    public function destroy(int $id)
    {
        $t = MfgInputType::find($id);
        if (! $t) {
            return $this->error('Tipo de insumo no encontrado', 404);
        }
        $t->delete();

        return $this->success(null, 'Tipo de insumo eliminado');
    }
}
