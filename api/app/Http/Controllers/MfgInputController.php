<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgInput;
use App\Models\MfgInputBatch;
use App\Services\Manufacturing\MfgPlantCatalogService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Catálogo de insumos / materiales propio de la app Fábrica.
 */
class MfgInputController extends Controller
{
    use ApiResponse;

    public function __construct(private MfgPlantCatalogService $catalogs) {}

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

    // ---- Lotes / compras del insumo (para costear la ficha técnica) ----

    /** Lotes del insumo + precio promedio (para decidir el precio en la referencia). */
    public function batches(int $id)
    {
        return $this->success($this->catalogs->inputBatches($id));
    }

    public function storeBatch(Request $request, int $id)
    {
        $input = MfgInput::find($id);
        if (! $input) {
            return $this->error('Insumo no encontrado', 404);
        }
        $data = $request->validate([
            'colorId' => 'nullable|integer|exists:mfg_colors,id',
            'unitCost' => 'required|numeric|min:0',
            'quantity' => 'nullable|numeric|min:0',
            'purchasedAt' => 'nullable|date',
            'reference' => 'nullable|string|max:60',
        ]);

        return $this->created($this->catalogs->addInputBatch($input, $data), 'Lote registrado');
    }

    public function deleteBatch(int $id, int $batchId)
    {
        $b = MfgInputBatch::where('inputId', $id)->find($batchId);
        if (! $b) {
            return $this->error('Lote no encontrado', 404);
        }
        $b->delete();

        return $this->success(null, 'Lote eliminado');
    }
}
