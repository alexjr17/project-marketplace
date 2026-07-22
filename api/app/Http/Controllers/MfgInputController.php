<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgInput;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Catálogo de insumos / materiales propio de la app Fábrica.
 */
class MfgInputController extends Controller
{
    use ApiResponse;

    private function rules(int $ignoreId = 0): array
    {
        return [
            'code' => ['required', 'string', 'max:40', Rule::unique('mfg_inputs', 'code')->ignore($ignoreId)],
            'name' => 'required|string|max:120',
            'inputTypeId' => 'nullable|integer|exists:mfg_input_types,id',
            'unitOfMeasure' => 'nullable|string|max:20',
            'scope' => 'nullable|in:INTERNAL,EXTERNAL',
            'notes' => 'nullable|string',
            'isActive' => 'boolean',
        ];
    }

    public function index()
    {
        return $this->success(MfgInput::with('inputType:id,name,classification')->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        return $this->created(MfgInput::create($request->validate($this->rules())), 'Insumo creado');
    }

    public function update(Request $request, int $id)
    {
        $i = MfgInput::find($id);
        if (! $i) {
            return $this->error('Insumo no encontrado', 404);
        }
        $i->fill($request->validate($this->rules($id)))->save();

        return $this->success($i, 'Insumo actualizado');
    }

    public function destroy(int $id)
    {
        $i = MfgInput::find($id);
        if (! $i) {
            return $this->error('Insumo no encontrado', 404);
        }
        $i->delete();

        return $this->success(null, 'Insumo eliminado');
    }
}
