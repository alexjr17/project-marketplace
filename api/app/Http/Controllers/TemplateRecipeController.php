<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Color;
use App\Models\Product;
use App\Models\ProductInput;
use App\Models\ProductVariant;
use App\Models\TemplateRecipe;
use App\Services\TemplateStockService;
use Illuminate\Http\Request;

class TemplateRecipeController extends Controller
{
    use ApiResponse;

    public function __construct(private TemplateStockService $templateStock) {}

    private const RECIPE_RELATIONS = [
        'variant.product', 'variant.color', 'variant.size',
        'inputVariant.input', 'inputVariant.color', 'inputVariant.size',
    ];

    /** Stock disponible de todas las variantes de un template (público, para el carrito). */
    public function availableStock(int $productId)
    {
        $variants = ProductVariant::with('color', 'size')->where('productId', $productId)->get();

        $data = $variants->map(fn ($v) => [
            'variantId' => $v->id,
            'sku' => $v->sku,
            'color' => $v->color?->name ?? 'N/A',
            'size' => $v->size?->name ?? 'N/A',
            'availableStock' => $this->templateStock->getAvailableStockForTemplate($v->id),
        ]);

        return $this->success($data);
    }

    /** Stock de una variante específica por color/talla (público, para el carrito). */
    public function variantStock(Request $request, int $productId)
    {
        $colorId = $request->query('colorId');
        $sizeId = $request->query('sizeId');
        $colorHex = $request->query('colorHex');
        $sizeName = $request->query('sizeName');

        $variant = null;
        if ($colorId !== null || $sizeId !== null) {
            $variant = ProductVariant::where('productId', $productId)
                ->where('colorId', $colorId)->where('sizeId', $sizeId)->first();
        }
        if (! $variant && ($colorHex || $sizeName)) {
            $variant = ProductVariant::with('color', 'size')->where('productId', $productId)->get()
                ->first(function ($v) use ($colorHex, $sizeName) {
                    $colorMatch = ! $colorHex || strtolower((string) $v->color?->hexCode) === strtolower($colorHex);
                    $sizeMatch = ! $sizeName || $v->size?->name === $sizeName || $v->size?->abbreviation === $sizeName;

                    return $colorMatch && $sizeMatch;
                });
        }

        if (! $variant) {
            return $this->success(['variantId' => null, 'sku' => '', 'availableStock' => 0, 'message' => 'Variante no encontrada']);
        }

        return $this->success([
            'variantId' => $variant->id,
            'sku' => $variant->sku,
            'availableStock' => $this->templateStock->getAvailableStockForTemplate($variant->id),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'variantId' => 'required|integer',
            'inputVariantId' => 'required|integer',
            'quantity' => 'nullable|numeric',
        ]);

        $recipe = TemplateRecipe::updateOrCreate(
            ['variantId' => $data['variantId'], 'inputVariantId' => $data['inputVariantId']],
            ['quantity' => $data['quantity'] ?? 1]
        );

        return $this->success($recipe->load(self::RECIPE_RELATIONS), 'Receta guardada');
    }

    public function byVariant(int $variantId)
    {
        return $this->success(
            TemplateRecipe::with(self::RECIPE_RELATIONS)->where('variantId', $variantId)->get()
        );
    }

    public function byProduct(int $productId)
    {
        $recipes = TemplateRecipe::with(self::RECIPE_RELATIONS)
            ->whereHas('variant', fn ($q) => $q->where('productId', $productId))
            ->get();

        return $this->success($recipes);
    }

    public function associatedInputIds(int $productId)
    {
        return $this->success(ProductInput::where('productId', $productId)->pluck('inputId'));
    }

    public function associateInputs(Request $request, int $productId)
    {
        $data = $request->validate([
            'inputIds' => 'required|array',
            'inputIds.*' => 'integer',
        ]);

        $product = Product::find($productId);
        if (! $product || ! $product->isTemplate) {
            return $this->error('El producto no es un template', 400);
        }

        ProductInput::where('productId', $productId)->delete();
        foreach (array_unique($data['inputIds']) as $inputId) {
            ProductInput::create(['productId' => $productId, 'inputId' => $inputId]);
        }

        return $this->success(
            ['created' => count(array_unique($data['inputIds']))],
            count($data['inputIds']).' insumo(s) asociado(s) exitosamente'
        );
    }

    public function destroySpecific(int $variantId, int $inputVariantId)
    {
        TemplateRecipe::where('variantId', $variantId)->where('inputVariantId', $inputVariantId)->delete();

        return $this->success(null, 'Receta eliminada');
    }

    public function destroyByVariant(int $variantId)
    {
        TemplateRecipe::where('variantId', $variantId)->delete();

        return $this->success(null, 'Recetas eliminadas');
    }
}
