<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Input;
use App\Models\InputBatch;
use App\Models\InputColor;
use App\Models\InputSize;
use App\Models\InputVariant;
use App\Models\InputVariantMovement;
use App\Models\Size;
use Illuminate\Http\Request;

class InputController extends Controller
{
    use ApiResponse;

    private const FULL = [
        'inputType.inputTypeSizes.size',
        'inputColors.color',
        'inputSizes.size',
        'variants' => null,
    ];

    /** Carga un insumo con todas sus relaciones y el conteo. */
    private function loadInput(int $id): ?array
    {
        $input = Input::with([
            'inputType.inputTypeSizes.size',
            'inputColors.color',
            'inputSizes.size',
            'variants' => fn ($q) => $q->where('isActive', true)->with('color', 'size'),
            'batches' => fn ($q) => $q->where('isActive', true)->orderByDesc('createdAt'),
        ])->withCount(['batches', 'movements', 'zoneInputs', 'variants'])->find($id);

        return $input ? $this->format($input) : null;
    }

    private function format(Input $input): array
    {
        $arr = $input->toArray();
        $arr['_count'] = [
            'batches' => $input->batches_count ?? 0,
            'movements' => $input->movements_count ?? 0,
            'zoneInputs' => $input->zone_inputs_count ?? 0,
            'variants' => $input->variants_count ?? 0,
        ];

        return $arr;
    }

    // ==================== INSUMOS ====================

    public function index(Request $request)
    {
        $query = Input::with([
            'inputType.inputTypeSizes.size',
            'inputColors.color',
            'inputSizes.size',
            'variants' => fn ($q) => $q->where('isActive', true)->with('color', 'size'),
        ])->withCount(['batches', 'movements', 'zoneInputs', 'variants'])
            ->where('isActive', true);

        if ($request->filled('inputTypeId')) {
            $query->where('inputTypeId', (int) $request->query('inputTypeId'));
        }
        if ($request->filled('search')) {
            $s = $request->query('search');
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                    ->orWhere('code', 'like', "%{$s}%")
                    ->orWhere('supplier', 'like', "%{$s}%");
            });
        }
        if (filter_var($request->query('lowStock'), FILTER_VALIDATE_BOOLEAN)) {
            $query->whereColumn('currentStock', '<=', 'minStock');
        }

        $inputs = $query->orderByDesc('createdAt')->get()->map(fn ($i) => $this->format($i));

        return $this->success($inputs);
    }

    public function lowStock()
    {
        $inputs = Input::with('inputType:id,name,slug,hasVariants')
            ->where('isActive', true)
            ->whereColumn('currentStock', '<=', 'minStock')
            ->orderBy('currentStock')
            ->get();

        return $this->success($inputs);
    }

    public function allVariants()
    {
        $variants = InputVariant::with([
            'input:id,code,name,unitOfMeasure,isActive',
            'color:id,name,hexCode',
            'size:id,name,abbreviation',
        ])->where('isActive', true)->get();

        return $this->success($variants);
    }

    public function show(int $id)
    {
        $input = $this->loadInput($id);

        return $input ? $this->success($input) : $this->error('Insumo no encontrado', 404);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'code' => 'required|string',
            'name' => 'required|string',
            'description' => 'nullable|string',
            'inputTypeId' => 'required|integer',
            'unitOfMeasure' => 'required|string',
            'unitCost' => 'required|numeric|min:0',
            'minStock' => 'nullable|numeric',
            'maxStock' => 'nullable|numeric',
            'supplier' => 'nullable|string',
            'supplierCode' => 'nullable|string',
            'notes' => 'nullable|string',
            'colorIds' => 'nullable|array',
            'sizeIds' => 'nullable|array',
        ]);

        if (Input::where('code', $data['code'])->exists()) {
            return $this->error('Ya existe un insumo con este código', 400);
        }

        $input = Input::create([
            'code' => $data['code'],
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'inputTypeId' => $data['inputTypeId'],
            'unitOfMeasure' => $data['unitOfMeasure'],
            'unitCost' => $data['unitCost'],
            'currentStock' => 0,
            'minStock' => $data['minStock'] ?? 0,
            'maxStock' => $data['maxStock'] ?? 0,
            'supplier' => $data['supplier'] ?? null,
            'supplierCode' => $data['supplierCode'] ?? null,
            'notes' => $data['notes'] ?? null,
            'isActive' => true,
        ]);

        $colorIds = $data['colorIds'] ?? [];
        $sizeIds = $data['sizeIds'] ?? [];

        foreach ($colorIds as $colorId) {
            InputColor::create(['inputId' => $input->id, 'colorId' => $colorId]);
        }
        if ($colorIds && $sizeIds) {
            $sizes = Size::whereIn('id', $sizeIds)->get();
            foreach ($colorIds as $colorId) {
                foreach ($sizes as $size) {
                    InputVariant::create([
                        'inputId' => $input->id,
                        'colorId' => $colorId,
                        'sizeId' => $size->id,
                        'sku' => "{$data['code']}-{$colorId}-{$size->abbreviation}",
                        'unitCost' => $data['unitCost'],
                    ]);
                }
            }
        }

        return $this->created($this->loadInput($input->id), 'Insumo creado');
    }

    public function update(Request $request, int $id)
    {
        $input = Input::find($id);
        if (! $input) {
            return $this->error('Insumo no encontrado', 404);
        }

        $data = $request->validate([
            'code' => 'nullable|string',
            'name' => 'nullable|string',
            'description' => 'nullable|string',
            'inputTypeId' => 'nullable|integer',
            'unitOfMeasure' => 'nullable|string',
            'unitCost' => 'nullable|numeric|min:0',
            'minStock' => 'nullable|numeric',
            'maxStock' => 'nullable|numeric',
            'supplier' => 'nullable|string',
            'supplierCode' => 'nullable|string',
            'notes' => 'nullable|string',
            'isActive' => 'nullable|boolean',
        ]);

        $input->fill(array_filter($data, fn ($v) => $v !== null));
        $input->save();

        return $this->success($this->loadInput($id), 'Insumo actualizado');
    }

    public function destroy(int $id)
    {
        $input = Input::find($id);
        if (! $input) {
            return $this->error('Insumo no encontrado', 404);
        }
        $input->isActive = false;
        $input->save();

        return $this->success(null, 'Insumo eliminado');
    }

    public function recalculateStock(int $id)
    {
        $input = Input::find($id);
        if (! $input) {
            return $this->error('Insumo no encontrado', 404);
        }
        $total = InputBatch::where('inputId', $id)->where('isActive', true)->sum('currentQuantity');
        $input->currentStock = $total;
        $input->save();

        return $this->success($this->loadInput($id), 'Stock recalculado');
    }

    // ==================== COLORES Y TALLAS ====================

    public function addColor(Request $request, int $id)
    {
        $data = $request->validate(['colorId' => 'required|integer']);
        $input = Input::with('inputType.inputTypeSizes.size')->find($id);
        if (! $input) {
            return $this->error('Insumo no encontrado', 404);
        }
        if (! $input->inputType?->hasVariants) {
            return $this->error('Este tipo de insumo no soporta variantes', 400);
        }
        if (InputColor::where('inputId', $id)->where('colorId', $data['colorId'])->exists()) {
            return $this->error('El color ya está asignado a este insumo', 400);
        }

        InputColor::create(['inputId' => $id, 'colorId' => $data['colorId']]);
        foreach ($input->inputType->inputTypeSizes as $its) {
            InputVariant::create([
                'inputId' => $id,
                'colorId' => $data['colorId'],
                'sizeId' => $its->sizeId,
                'sku' => "{$input->code}-{$data['colorId']}-{$its->size?->abbreviation}",
                'unitCost' => $input->unitCost,
            ]);
        }

        return $this->success($this->loadInput($id), 'Color agregado');
    }

    public function removeColor(int $id, int $colorId)
    {
        if (InputVariant::where('inputId', $id)->where('colorId', $colorId)->where('currentStock', '>', 0)->exists()) {
            return $this->error('No se puede eliminar el color porque hay variantes con stock', 400);
        }
        InputVariant::where('inputId', $id)->where('colorId', $colorId)->delete();
        InputColor::where('inputId', $id)->where('colorId', $colorId)->delete();

        return $this->success($this->loadInput($id), 'Color eliminado');
    }

    public function addSize(Request $request, int $id)
    {
        $data = $request->validate(['sizeId' => 'required|integer']);
        $input = Input::with('inputType', 'inputColors')->find($id);
        if (! $input) {
            return $this->error('Insumo no encontrado', 404);
        }
        if (! $input->inputType?->hasVariants) {
            return $this->error('Este tipo de insumo no soporta variantes', 400);
        }
        if (InputSize::where('inputId', $id)->where('sizeId', $data['sizeId'])->exists()) {
            return $this->error('La talla ya está asignada a este insumo', 400);
        }
        $size = Size::find($data['sizeId']);
        if (! $size) {
            return $this->error('Talla no encontrada', 404);
        }

        InputSize::create(['inputId' => $id, 'sizeId' => $size->id]);
        foreach ($input->inputColors as $ic) {
            InputVariant::create([
                'inputId' => $id,
                'colorId' => $ic->colorId,
                'sizeId' => $size->id,
                'sku' => "{$input->code}-{$ic->colorId}-{$size->abbreviation}",
                'unitCost' => $input->unitCost,
            ]);
        }

        return $this->success($this->loadInput($id), 'Talla agregada');
    }

    public function removeSize(int $id, int $sizeId)
    {
        if (InputVariant::where('inputId', $id)->where('sizeId', $sizeId)->where('currentStock', '>', 0)->exists()) {
            return $this->error('No se puede eliminar la talla porque hay variantes con stock', 400);
        }
        InputVariant::where('inputId', $id)->where('sizeId', $sizeId)->delete();
        InputSize::where('inputId', $id)->where('sizeId', $sizeId)->delete();

        return $this->success($this->loadInput($id), 'Talla eliminada');
    }

    public function regenerateVariants(int $id)
    {
        $input = Input::with('inputType.inputTypeSizes', 'inputColors', 'variants')->find($id);
        if (! $input || ! $input->inputType?->hasVariants) {
            return $this->error('Insumo no válido para regenerar variantes', 400);
        }

        foreach ($input->inputColors as $ic) {
            foreach ($input->inputType->inputTypeSizes as $its) {
                $exists = $input->variants->first(fn ($v) => $v->colorId === $ic->colorId && $v->sizeId === $its->sizeId);
                if (! $exists) {
                    $size = Size::find($its->sizeId);
                    InputVariant::create([
                        'inputId' => $id,
                        'colorId' => $ic->colorId,
                        'sizeId' => $its->sizeId,
                        'sku' => "{$input->code}-{$ic->colorId}-{$size?->abbreviation}",
                        'unitCost' => $input->unitCost,
                    ]);
                }
            }
        }

        return $this->success($this->loadInput($id), 'Variantes regeneradas');
    }

    // ==================== VARIANTES DE INSUMO ====================

    public function variants(int $id)
    {
        $variants = InputVariant::with('color', 'size')
            ->where('inputId', $id)->where('isActive', true)->get();

        return $this->success($variants);
    }

    public function variantById(int $variantId)
    {
        $variant = InputVariant::with('input.inputType', 'color', 'size')->find($variantId);

        return $variant ? $this->success($variant) : $this->error('Variante no encontrada', 404);
    }

    public function updateVariant(Request $request, int $variantId)
    {
        $variant = InputVariant::find($variantId);
        if (! $variant) {
            return $this->error('Variante no encontrada', 404);
        }
        $data = $request->validate([
            'unitCost' => 'nullable|numeric',
            'minStock' => 'nullable|numeric',
            'maxStock' => 'nullable|numeric',
            'isActive' => 'nullable|boolean',
        ]);
        $variant->fill(array_filter($data, fn ($v) => $v !== null));
        $variant->save();

        return $this->success($variant->load('color', 'size'), 'Variante actualizada');
    }

    public function updateVariantStock(Request $request, int $variantId)
    {
        $data = $request->validate([
            'quantity' => 'required|numeric',
            'operation' => 'required|in:add,subtract',
        ]);
        $variant = InputVariant::find($variantId);
        if (! $variant) {
            return $this->error('Variante no encontrada', 404);
        }
        $newStock = $data['operation'] === 'add'
            ? (float) $variant->currentStock + $data['quantity']
            : (float) $variant->currentStock - $data['quantity'];
        if ($newStock < 0) {
            return $this->error('Stock insuficiente', 400);
        }
        $variant->currentStock = $newStock;
        $variant->save();

        return $this->success($variant, 'Stock actualizado');
    }

    public function variantMovements(Request $request, int $variantId)
    {
        $limit = (int) ($request->query('limit') ?: 50);
        $movements = InputVariantMovement::where('inputVariantId', $variantId)
            ->orderByDesc('createdAt')->take($limit)->get();

        return $this->success($movements);
    }
}
