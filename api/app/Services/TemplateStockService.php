<?php

namespace App\Services;

use App\Models\InputVariant;
use App\Models\ProductInput;
use App\Models\ProductVariant;
use App\Models\TemplateRecipe;

/**
 * Stock de las variantes de plantillas (productos personalizables).
 *
 * De dónde sale el stock de una variante (en este orden):
 *  1) Receta (TemplateRecipe): el insumo que alcance para menos unidades manda.
 *  2) Insumo asociado a la plantilla (ProductInput) que coincida en color/talla.
 *  3) Si no tiene ninguno de los dos: el stock propio de la variante (product_variants.stock),
 *     que se descuenta al crear el pedido como un producto normal.
 * Antes, sin receta ni insumo el stock era 0 y nada se podía vender.
 */
class TemplateStockService
{
    public const SOURCE_RECIPE = 'recipe';
    public const SOURCE_INPUT = 'input';
    public const SOURCE_VARIANT = 'variant';

    /** Stock disponible de una variante de template. */
    public function getAvailableStockForTemplate(int $variantId): float
    {
        $recipes = TemplateRecipe::with('inputVariant')->where('variantId', $variantId)->get();

        if ($recipes->isNotEmpty()) {
            $stocks = $recipes->map(function ($recipe) {
                $inputStock = (float) ($recipe->inputVariant->currentStock ?? 0);
                $quantity = (float) ($recipe->quantity ?: 1);

                return $quantity > 0 ? floor($inputStock / $quantity) : 0;
            });

            return (float) $stocks->min();
        }

        $variant = ProductVariant::find($variantId);
        if (! $variant) {
            return 0;
        }

        $match = $this->matchingInputVariant($variant);
        if ($match) {
            return (float) $match->currentStock;
        }

        return max(0, (float) $variant->stock);
    }

    /** De dónde sale el stock de la variante: receta, insumo asociado o la variante misma. */
    public function stockSource(ProductVariant $variant): string
    {
        if (TemplateRecipe::where('variantId', $variant->id)->exists()) {
            return self::SOURCE_RECIPE;
        }

        return $this->matchingInputVariant($variant) ? self::SOURCE_INPUT : self::SOURCE_VARIANT;
    }

    /** Insumo asociado a la plantilla que coincide con el color/talla de la variante. */
    public function matchingInputVariant(ProductVariant $variant): ?InputVariant
    {
        $productInputs = ProductInput::where('productId', $variant->productId)
            ->with(['input.variants' => fn ($q) => $q->where('isActive', true)])
            ->get();
        $inputVariants = $productInputs->flatMap(fn ($pi) => $pi->input?->variants ?? []);

        return $inputVariants->first(function ($iv) use ($variant) {
            $colorMatch = $variant->colorId === null || $iv->colorId === $variant->colorId;
            $sizeMatch = $variant->sizeId === null || $iv->sizeId === $variant->sizeId;

            return $colorMatch && $sizeMatch;
        });
    }
}
