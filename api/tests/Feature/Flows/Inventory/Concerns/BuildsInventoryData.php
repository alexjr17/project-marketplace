<?php

namespace Tests\Feature\Flows\Inventory\Concerns;

use App\Models\Color;
use App\Models\Input;
use App\Models\InputBatch;
use App\Models\InputColor;
use App\Models\InputSize;
use App\Models\InputType;
use App\Models\InputTypeSize;
use App\Models\InputVariant;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Size;
use App\Models\Supplier;

/**
 * Fábrica mínima de datos de inventario/compras para los tests de
 * caracterización (solo existe UserFactory, así que se crean con los modelos).
 */
trait BuildsInventoryData
{
    protected function makeColor(string $name = 'Negro', string $hex = '#000000'): Color
    {
        return Color::create([
            'name' => $name,
            'slug' => strtolower(str_replace(' ', '-', $name)),
            'hexCode' => $hex,
            'isActive' => true,
        ]);
    }

    protected function makeSize(string $abbr = 'M', int $sort = 1): Size
    {
        return Size::create([
            'name' => 'Talla '.$abbr,
            'abbreviation' => $abbr,
            'sortOrder' => $sort,
            'isActive' => true,
        ]);
    }

    /** @param  Size[]  $sizes */
    protected function makeInputType(bool $hasVariants = false, array $sizes = [], string $name = 'Consumible'): InputType
    {
        $type = InputType::create([
            'name' => $name,
            'slug' => strtolower(str_replace(' ', '-', $name)).'-'.uniqid(),
            'sortOrder' => 0,
            'hasVariants' => $hasVariants,
            'isActive' => true,
        ]);
        foreach ($sizes as $size) {
            InputTypeSize::create(['inputTypeId' => $type->id, 'sizeId' => $size->id]);
        }

        return $type;
    }

    protected function makeInput(array $attrs = []): Input
    {
        if (! isset($attrs['inputTypeId'])) {
            $attrs['inputTypeId'] = $this->makeInputType()->id;
        }

        return Input::create($attrs + [
            'code' => 'INS-'.uniqid(),
            'name' => 'Insumo de prueba',
            'unitOfMeasure' => 'unidad',
            'unitCost' => 1000,
            'currentStock' => 0,
            'minStock' => 0,
            'maxStock' => 0,
            'isActive' => true,
        ]);
    }

    protected function makeBatch(Input $input, float $qty, float $unitCost = 1000, string $number = 'L-1'): InputBatch
    {
        return InputBatch::create([
            'inputId' => $input->id,
            'batchNumber' => $number,
            'initialQuantity' => $qty,
            'currentQuantity' => $qty,
            'reservedQuantity' => 0,
            'unitCost' => $unitCost,
            'totalCost' => $qty * $unitCost,
            'isActive' => true,
        ]);
    }

    /**
     * Insumo con variantes (tipo hasVariants) y una variante por color × talla.
     *
     * @return array{input: Input, variant: InputVariant, color: Color, size: Size}
     */
    protected function makeVariantInput(float $stock = 0, float $unitCost = 5000, string $code = 'CAM-01'): array
    {
        $color = Color::where('slug', 'blanco')->first() ?? $this->makeColor('Blanco', '#FFFFFF');
        $size = Size::where('abbreviation', 'L')->first() ?? $this->makeSize('L', 3);
        $type = $this->makeInputType(true, [$size], 'Prenda Base');
        $input = $this->makeInput([
            'code' => $code,
            'name' => 'Camiseta base',
            'inputTypeId' => $type->id,
            'unitCost' => $unitCost,
            'currentStock' => $stock,
        ]);
        InputColor::create(['inputId' => $input->id, 'colorId' => $color->id]);
        InputSize::create(['inputId' => $input->id, 'sizeId' => $size->id]);
        $variant = InputVariant::create([
            'inputId' => $input->id,
            'colorId' => $color->id,
            'sizeId' => $size->id,
            'sku' => "{$code}-BL-L",
            'unitCost' => $unitCost,
            'currentStock' => $stock,
            'isActive' => true,
        ]);

        return compact('input', 'variant', 'color', 'size');
    }

    protected function makeProduct(array $attrs = []): Product
    {
        $sku = $attrs['sku'] ?? 'PRD-'.uniqid();

        return Product::create($attrs + [
            'sku' => $sku,
            'slug' => strtolower($sku),
            'name' => 'Producto de prueba',
            'description' => 'Descripción',
            'basePrice' => 30000,
            'stock' => 0,
            'isActive' => true,
            'isTemplate' => false,
            'images' => [],
            'tags' => [],
        ]);
    }

    protected function makeProductVariant(Product $product, int $stock = 0, array $attrs = []): ProductVariant
    {
        return ProductVariant::create($attrs + [
            'productId' => $product->id,
            'sku' => $product->sku.'-'.uniqid(),
            'stock' => $stock,
            'minStock' => 0,
            'isActive' => true,
        ]);
    }

    protected function makeSupplier(string $code = 'PROV-001', string $name = 'Proveedor Uno'): Supplier
    {
        return Supplier::create([
            'code' => $code,
            'name' => $name,
            'country' => 'Colombia',
            'isActive' => true,
        ]);
    }
}
