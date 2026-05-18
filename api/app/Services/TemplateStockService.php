<?php

namespace App\Services;

use App\Models\ProductInput;
use App\Models\ProductVariant;
use App\Models\TemplateRecipe;

/**
 * Cálculo de stock disponible para variantes de plantillas (templates),
 * a partir del stock de sus insumos. Replica template-recipes.service del Node.
 */
class TemplateStockService
{
    /**
     * Stock disponible de una variante de template.
     * 1) Si hay recetas (TemplateRecipe): cuello de botella entre ingredientes.
     * 2) Si no: matching por color/talla con los insumos asociados (ProductInput).
     */
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

        $productInputs = ProductInput::where('productId', $variant->productId)
            ->with(['input.variants' => fn ($q) => $q->where('isActive', true)])
            ->get();

        if ($productInputs->isEmpty()) {
            return 0;
        }

        $inputVariants = $productInputs->flatMap(fn ($pi) => $pi->input?->variants ?? []);

        $match = $inputVariants->first(function ($iv) use ($variant) {
            $colorMatch = $variant->colorId === null || $iv->colorId === $variant->colorId;
            $sizeMatch = $variant->sizeId === null || $iv->sizeId === $variant->sizeId;

            return $colorMatch && $sizeMatch;
        });

        return $match ? (float) $match->currentStock : 0;
    }
}
