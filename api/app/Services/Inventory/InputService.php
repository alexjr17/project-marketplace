<?php

namespace App\Services\Inventory;

use App\Exceptions\BusinessRuleException;
use App\Exceptions\InsufficientStockException;
use App\Models\Input;
use App\Models\InputColor;
use App\Models\InputSize;
use App\Models\InputVariant;
use App\Models\InputVariantMovement;
use App\Models\Size;
use App\Services\StockService;
use Illuminate\Support\Facades\DB;

/**
 * Insumos: alta y edición (código único), colores y tallas con sus variantes
 * (SKU = {código}-{colorId}-{abreviatura}), y el stock manual de cada variante, que se mueve
 * con StockService y deja movimiento (antes cambiaba el número sin rastro).
 */
class InputService
{
    private const LIST_RELATIONS = ['inputType.inputTypeSizes.size', 'inputColors.color', 'inputSizes.size'];

    private const COUNTS = ['batches', 'movements', 'zoneInputs', 'variants'];

    public function __construct(private StockService $stock, private InputBatchService $batches) {}

    public function list(array $filters): array
    {
        $query = Input::with(self::LIST_RELATIONS + [
            'variants' => fn ($q) => $q->where('isActive', true)->with('color', 'size'),
        ])->withCount(self::COUNTS)->where('isActive', true);

        if (! empty($filters['inputTypeId'])) {
            $query->where('inputTypeId', (int) $filters['inputTypeId']);
        }
        if (! empty($filters['search'])) {
            $s = $filters['search'];
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")->orWhere('code', 'like', "%{$s}%")->orWhere('supplier', 'like', "%{$s}%");
            });
        }
        if (filter_var($filters['lowStock'] ?? null, FILTER_VALIDATE_BOOLEAN)) {
            $query->whereColumn('currentStock', '<=', 'minStock');
        }

        return $query->orderByDesc('createdAt')->get()->map(fn ($i) => $this->format($i))->all();
    }

    public function lowStock()
    {
        return Input::with('inputType:id,name,slug,hasVariants')
            ->where('isActive', true)->whereColumn('currentStock', '<=', 'minStock')
            ->orderBy('currentStock')->get();
    }

    public function allVariants()
    {
        return InputVariant::with(['input:id,code,name,unitOfMeasure,isActive', 'color:id,name,hexCode', 'size:id,name,abbreviation'])
            ->where('isActive', true)->get();
    }

    /** Insumo con todas sus relaciones y conteos. */
    public function detail(int $id): array
    {
        $input = Input::with(self::LIST_RELATIONS + [
            'variants' => fn ($q) => $q->where('isActive', true)->with('color', 'size'),
            'batches' => fn ($q) => $q->where('isActive', true)->orderByDesc('createdAt'),
        ])->withCount(self::COUNTS)->find($id);
        if (! $input) {
            throw new BusinessRuleException('Insumo no encontrado', 404);
        }

        return $this->format($input);
    }

    /** Crea el insumo con sus colores, tallas y (si hay ambos) las variantes color × talla. */
    public function create(array $data): array
    {
        if (Input::where('code', $data['code'])->exists()) {
            throw new BusinessRuleException('Ya existe un insumo con este código', 400);
        }

        $id = DB::transaction(function () use ($data) {
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

            $colorIds = array_values(array_unique($data['colorIds'] ?? []));
            $sizes = Size::whereIn('id', $data['sizeIds'] ?? [])->get();

            foreach ($colorIds as $colorId) {
                InputColor::create(['inputId' => $input->id, 'colorId' => $colorId]);
            }
            // Antes las tallas no se guardaban aunque llegaran (quedaba inputSizes vacío).
            foreach ($sizes as $size) {
                InputSize::create(['inputId' => $input->id, 'sizeId' => $size->id]);
            }
            foreach ($colorIds as $colorId) {
                foreach ($sizes as $size) {
                    $this->createVariant($input, $colorId, $size);
                }
            }

            return $input->id;
        });

        return $this->detail($id);
    }

    public function update(int $id, array $data): array
    {
        $input = $this->find($id);
        if (! empty($data['code']) && $data['code'] !== $input->code && Input::where('code', $data['code'])->exists()) {
            throw new BusinessRuleException('Ya existe un insumo con este código', 400);
        }
        $input->fill(array_filter($data, fn ($v) => $v !== null));
        $input->save();

        return $this->detail($id);
    }

    /** Baja lógica. */
    public function deactivate(int $id): void
    {
        $input = $this->find($id);
        $input->isActive = false;
        $input->save();
    }

    public function recalculateStock(int $id): array
    {
        $this->find($id);
        $this->batches->recalcInputStock($id);

        return $this->detail($id);
    }

    // ==================== Colores y tallas ====================

    public function addColor(int $id, int $colorId): array
    {
        $input = Input::with('inputType.inputTypeSizes.size')->find($id);
        if (! $input) {
            throw new BusinessRuleException('Insumo no encontrado', 404);
        }
        if (! $input->inputType?->hasVariants) {
            throw new BusinessRuleException('Este tipo de insumo no soporta variantes', 400);
        }
        if (InputColor::where('inputId', $id)->where('colorId', $colorId)->exists()) {
            throw new BusinessRuleException('El color ya está asignado a este insumo', 400);
        }

        DB::transaction(function () use ($input, $colorId) {
            InputColor::create(['inputId' => $input->id, 'colorId' => $colorId]);
            foreach ($input->inputType->inputTypeSizes as $its) {
                $this->createVariant($input, $colorId, $its->size, $its->sizeId);
            }
        });

        return $this->detail($id);
    }

    public function removeColor(int $id, int $colorId): array
    {
        if (InputVariant::where('inputId', $id)->where('colorId', $colorId)->where('currentStock', '>', 0)->exists()) {
            throw new BusinessRuleException('No se puede eliminar el color porque hay variantes con stock', 400);
        }
        DB::transaction(function () use ($id, $colorId) {
            InputVariant::where('inputId', $id)->where('colorId', $colorId)->delete();
            InputColor::where('inputId', $id)->where('colorId', $colorId)->delete();
        });

        return $this->detail($id);
    }

    public function addSize(int $id, int $sizeId): array
    {
        $input = Input::with('inputType', 'inputColors')->find($id);
        if (! $input) {
            throw new BusinessRuleException('Insumo no encontrado', 404);
        }
        if (! $input->inputType?->hasVariants) {
            throw new BusinessRuleException('Este tipo de insumo no soporta variantes', 400);
        }
        if (InputSize::where('inputId', $id)->where('sizeId', $sizeId)->exists()) {
            throw new BusinessRuleException('La talla ya está asignada a este insumo', 400);
        }
        $size = Size::find($sizeId);
        if (! $size) {
            throw new BusinessRuleException('Talla no encontrada', 404);
        }

        DB::transaction(function () use ($input, $size) {
            InputSize::create(['inputId' => $input->id, 'sizeId' => $size->id]);
            foreach ($input->inputColors as $ic) {
                $this->createVariant($input, $ic->colorId, $size);
            }
        });

        return $this->detail($id);
    }

    public function removeSize(int $id, int $sizeId): array
    {
        if (InputVariant::where('inputId', $id)->where('sizeId', $sizeId)->where('currentStock', '>', 0)->exists()) {
            throw new BusinessRuleException('No se puede eliminar la talla porque hay variantes con stock', 400);
        }
        DB::transaction(function () use ($id, $sizeId) {
            InputVariant::where('inputId', $id)->where('sizeId', $sizeId)->delete();
            InputSize::where('inputId', $id)->where('sizeId', $sizeId)->delete();
        });

        return $this->detail($id);
    }

    /** Crea las variantes color × talla del tipo que falten. */
    public function regenerateVariants(int $id): array
    {
        $input = Input::with('inputType.inputTypeSizes.size', 'inputColors', 'variants')->find($id);
        if (! $input || ! $input->inputType?->hasVariants) {
            throw new BusinessRuleException('Insumo no válido para regenerar variantes', 400);
        }

        DB::transaction(function () use ($input) {
            foreach ($input->inputColors as $ic) {
                foreach ($input->inputType->inputTypeSizes as $its) {
                    $exists = $input->variants->first(fn ($v) => $v->colorId === $ic->colorId && $v->sizeId === $its->sizeId);
                    if (! $exists) {
                        $this->createVariant($input, $ic->colorId, $its->size, $its->sizeId);
                    }
                }
            }
        });

        return $this->detail($id);
    }

    // ==================== Variantes ====================

    public function variants(int $id)
    {
        return InputVariant::with('color', 'size')->where('inputId', $id)->where('isActive', true)->get();
    }

    public function variant(int $variantId): InputVariant
    {
        $variant = InputVariant::with('input.inputType', 'color', 'size')->find($variantId);
        if (! $variant) {
            throw new BusinessRuleException('Variante no encontrada', 404);
        }

        return $variant;
    }

    public function updateVariant(int $variantId, array $data): InputVariant
    {
        $variant = InputVariant::find($variantId);
        if (! $variant) {
            throw new BusinessRuleException('Variante no encontrada', 404);
        }
        $variant->fill(array_filter($data, fn ($v) => $v !== null));
        $variant->save();

        return $variant->load('color', 'size');
    }

    /** Suma o resta stock a mano a una variante de insumo, con movimiento ENTRADA / SALIDA. */
    public function changeVariantStock(int $variantId, float $quantity, string $operation, ?int $userId): InputVariant
    {
        if (! InputVariant::whereKey($variantId)->exists()) {
            throw new BusinessRuleException('Variante no encontrada', 404);
        }
        $attrs = ['reason' => 'Ajuste manual de stock', 'referenceType' => 'manual', 'userId' => $userId];

        try {
            $operation === 'add'
                ? $this->stock->inputVariantIn($variantId, $quantity, 'ENTRADA', $attrs)
                : $this->stock->inputVariantOut($variantId, $quantity, 'SALIDA', $attrs);
        } catch (InsufficientStockException) {
            throw new BusinessRuleException('Stock insuficiente', 400);
        }

        return InputVariant::find($variantId);
    }

    public function variantMovements(int $variantId, int $limit)
    {
        return InputVariantMovement::where('inputVariantId', $variantId)->orderByDesc('createdAt')->take($limit)->get();
    }

    // ==================== Utilidades ====================

    private function find(int $id): Input
    {
        $input = Input::find($id);
        if (! $input) {
            throw new BusinessRuleException('Insumo no encontrado', 404);
        }

        return $input;
    }

    private function createVariant(Input $input, int $colorId, ?Size $size, ?int $sizeId = null): void
    {
        InputVariant::create([
            'inputId' => $input->id,
            'colorId' => $colorId,
            'sizeId' => $size?->id ?? $sizeId,
            'sku' => "{$input->code}-{$colorId}-{$size?->abbreviation}",
            'unitCost' => $input->unitCost,
        ]);
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
}
