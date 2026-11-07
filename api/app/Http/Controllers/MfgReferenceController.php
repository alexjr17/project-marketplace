<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgReference;
use App\Services\Manufacturing\MfgReferenceService;
use Illuminate\Http\Request;

/**
 * Referencias de la app Fábrica con su ficha técnica. Valida y responde; el armado de la
 * ficha, los costos y el código los hace MfgReferenceService.
 */
class MfgReferenceController extends Controller
{
    use ApiResponse;

    public function __construct(private MfgReferenceService $references) {}

    private function rules(): array
    {
        return [
            'name' => 'required|string|max:150',
            'code' => 'nullable|string|max:60',
            'garmentTypeId' => 'required|integer|exists:mfg_garment_types,id',
            'collectionId' => 'nullable|integer|exists:mfg_collections,id',
            'description' => 'nullable|string',
            'isActive' => 'boolean',
            'imagePath' => 'nullable|string|max:500',
            'fixedCost' => 'nullable|numeric|min:0',
            'factor' => 'nullable|numeric|min:0',
            // Colores con tipo.
            'colors' => 'nullable|array',
            'colors.*.colorId' => 'required|integer|exists:mfg_colors,id',
            'colors.*.type' => 'nullable|in:PRIMARY,SECONDARY',
            // Tallas base.
            'sizeIds' => 'nullable|array',
            'sizeIds.*' => 'integer|exists:mfg_sizes,id',
            // Componentes.
            'components' => 'nullable|array',
            'components.*.position' => 'required|in:SUPERIOR,INFERIOR',
            'components.*.description' => 'nullable|string|max:200',
            // Materiales (BOM).
            'materials' => 'nullable|array',
            'materials.*.inputId' => 'required|integer|exists:mfg_inputs,id',
            'materials.*.colorId' => 'nullable|integer|exists:mfg_colors,id',
            'materials.*.componentIndex' => 'nullable|integer|min:0',
            'materials.*.consumptionInitial' => 'nullable|numeric|min:0',
            'materials.*.increment' => 'nullable|numeric|min:0',
            'materials.*.consumption' => 'nullable|numeric|min:0',
            'materials.*.unitValue' => 'nullable|numeric|min:0',
            'materials.*.unitOfMeasure' => 'nullable|string|max:20',
            'materials.*.notes' => 'nullable|string',
            // Grupos de tallas (listas de precio).
            'sizeGroups' => 'nullable|array',
            'sizeGroups.*.name' => 'required|string|max:120',
            'sizeGroups.*.market' => 'nullable|in:NATIONAL,EXPORT',
            'sizeGroups.*.fixedCostExtra' => 'nullable|numeric|min:0',
            'sizeGroups.*.factor' => 'nullable|numeric|min:0',
            'sizeGroups.*.listPrice' => 'nullable|numeric|min:0',
            'sizeGroups.*.isWholesale' => 'boolean',
            'sizeGroups.*.sizeIds' => 'nullable|array',
            'sizeGroups.*.sizeIds.*' => 'integer|exists:mfg_sizes,id',
            'sizeGroups.*.surcharges' => 'nullable|array',
            'sizeGroups.*.surcharges.*.colorId' => 'required|integer|exists:mfg_colors,id',
            'sizeGroups.*.surcharges.*.amount' => 'nullable|numeric|min:0',
        ];
    }

    public function index(Request $request)
    {
        return $this->success($this->references->list([
            'search' => $request->filled('search') ? (string) $request->string('search') : null,
            'isActive' => $request->filled('isActive') ? $request->boolean('isActive') : null,
        ]));
    }

    public function show(int $id)
    {
        $ref = $this->references->find($id);

        return $ref ? $this->success($ref) : $this->error('Referencia no encontrada', 404);
    }

    public function generateCode(Request $request)
    {
        $data = $request->validate(['garmentTypeId' => 'required|integer|exists:mfg_garment_types,id']);

        return $this->success(['code' => $this->references->previewCode((int) $data['garmentTypeId'])]);
    }

    public function store(Request $request)
    {
        return $this->created($this->references->create($request->validate($this->rules())), 'Referencia creada');
    }

    public function update(Request $request, int $id)
    {
        $ref = MfgReference::find($id);
        if (! $ref) {
            return $this->error('Referencia no encontrada', 404);
        }

        return $this->success($this->references->update($ref, $request->validate($this->rules())), 'Referencia actualizada');
    }

    public function destroy(int $id)
    {
        $ref = MfgReference::find($id);
        if (! $ref) {
            return $this->error('Referencia no encontrada', 404);
        }
        $this->references->delete($ref);

        return $this->success(null, 'Referencia eliminada');
    }
}
