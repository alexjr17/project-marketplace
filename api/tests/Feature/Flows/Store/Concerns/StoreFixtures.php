<?php

namespace Tests\Feature\Flows\Store\Concerns;

use App\Models\Category;
use App\Models\Color;
use App\Models\Input;
use App\Models\InputType;
use App\Models\InputVariant;
use App\Models\Product;
use App\Models\ProductColor;
use App\Models\ProductSize;
use App\Models\ProductType;
use App\Models\ProductVariant;
use App\Models\Size;
use App\Models\TemplateRecipe;
use Database\Seeders\CatalogSeeder;

/**
 * Productos deterministas para los tests de la tienda (sobre el catálogo de CatalogSeeder:
 * categorías, tallas, colores y tipos).
 */
trait StoreFixtures
{
    private int $skuSeq = 0;

    protected function seedStoreCatalog(): void
    {
        $this->seed(CatalogSeeder::class);
    }

    /**
     * Crea un producto. $variants = [[colorSlug|null, sizeAbbr|null, stock], ...].
     * Sin variantes crea una variante simple (color/talla nulos) con stock 0.
     */
    protected function makeProduct(string $name, float $price, array $variants = [], array $attrs = []): Product
    {
        $this->skuSeq++;
        $category = Category::where('slug', $attrs['category'] ?? 'sueteres')->first();
        $type = isset($attrs['type']) ? ProductType::where('slug', $attrs['type'])->first() : null;
        unset($attrs['category'], $attrs['type']);

        $product = Product::create(array_merge([
            'sku' => sprintf('TST-%04d', $this->skuSeq),
            'slug' => \Illuminate\Support\Str::slug($name).'-'.$this->skuSeq,
            'name' => $name,
            'description' => "Descripción de {$name}",
            'categoryId' => $category?->id,
            'typeId' => $type?->id,
            'basePrice' => $price,
            'stock' => 0,
            'featured' => false,
            'isActive' => true,
            'isTemplate' => false,
            'images' => ['front' => "https://img.test/{$this->skuSeq}.jpg", 'back' => '', 'side' => ''],
            'tags' => ['test'],
            'reviewsCount' => 0,
        ], $attrs));

        if ($variants === []) {
            $variants = [[null, null, 0]];
        }
        $n = 0;
        foreach ($variants as [$colorSlug, $sizeAbbr, $stock]) {
            $n++;
            $color = $colorSlug ? Color::where('slug', $colorSlug)->firstOrFail() : null;
            $size = $sizeAbbr ? Size::where('abbreviation', $sizeAbbr)->firstOrFail() : null;
            if ($color) {
                ProductColor::firstOrCreate(['productId' => $product->id, 'colorId' => $color->id]);
            }
            if ($size) {
                ProductSize::firstOrCreate(['productId' => $product->id, 'sizeId' => $size->id]);
            }
            ProductVariant::create([
                'productId' => $product->id,
                'colorId' => $color?->id,
                'sizeId' => $size?->id,
                'sku' => $product->sku.'-'.$n,
                'stock' => $stock,
                'isActive' => true,
            ]);
        }

        return $product->fresh();
    }

    protected function variantOf(Product $product, ?string $colorSlug = null, ?string $sizeAbbr = null): ProductVariant
    {
        $q = ProductVariant::where('productId', $product->id);
        $colorSlug ? $q->whereHas('color', fn ($c) => $c->where('slug', $colorSlug)) : $q->whereNull('colorId');
        $sizeAbbr ? $q->whereHas('size', fn ($s) => $s->where('abbreviation', $sizeAbbr)) : $q->whereNull('sizeId');

        return $q->firstOrFail();
    }

    protected function hex(string $colorSlug): string
    {
        return Color::where('slug', $colorSlug)->value('hexCode');
    }

    /**
     * Plantilla personalizable (Negro / M) cuyo stock sale de un insumo: receta de 2 unidades
     * de la prenda base por cada plantilla. Devuelve [plantilla, variante del insumo].
     */
    protected function makeTemplateWithRecipe(float $inputStock = 10, float $recipeQty = 2): array
    {
        $tpl = $this->makeProduct('Plantilla Suéter', 70000, [['negro', 'M', 0]], ['isTemplate' => true]);
        $type = InputType::create(['name' => 'Prenda Base', 'slug' => 'prenda-base-test', 'hasVariants' => true]);
        $input = Input::create([
            'code' => 'INS-T1', 'name' => 'Suéter en blanco', 'inputTypeId' => $type->id,
            'unitOfMeasure' => 'unidad', 'unitCost' => 20000,
        ]);
        $iv = InputVariant::create([
            'inputId' => $input->id,
            'colorId' => Color::where('slug', 'negro')->value('id'),
            'sizeId' => Size::where('abbreviation', 'M')->value('id'),
            'sku' => 'INS-T1-NEG-M', 'unitCost' => 20000, 'currentStock' => $inputStock,
        ]);
        TemplateRecipe::create(['variantId' => $this->variantOf($tpl, 'negro', 'M')->id, 'inputVariantId' => $iv->id, 'quantity' => $recipeQty]);

        return [$tpl, $iv];
    }

    protected function orderPayload(array $items, array $extra = []): array
    {
        return array_merge([
            'items' => $items,
            'shipping' => ['name' => 'Cliente Demo', 'address' => 'Calle 1 # 2-3', 'city' => 'Cali', 'country' => 'Colombia'],
            'paymentMethod' => 'transfer',
        ], $extra);
    }

    protected function item(Product $p, ?string $colorSlug, ?string $size, int $qty): array
    {
        return [
            'productId' => $p->id,
            'color' => $colorSlug ? $this->hex($colorSlug) : '',
            'size' => $size ?? '',
            'quantity' => $qty,
        ];
    }
}
