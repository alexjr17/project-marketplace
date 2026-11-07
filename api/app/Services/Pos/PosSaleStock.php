<?php

namespace App\Services\Pos;

use App\Models\InputVariant;
use App\Models\Order;
use App\Models\ProductVariant;
use App\Models\TemplateRecipe;
use App\Models\VariantMovement;
use App\Services\StockService;
use App\Services\TemplateStockService;

/**
 * Stock de las líneas de una venta POS, con la misma regla que el pedido online:
 *  - Producto normal → stock de la variante.
 *  - Plantilla con receta → insumos de la receta.
 *  - Plantilla con insumo asociado (color/talla) → ese insumo.
 *  - Plantilla sin ninguno de los dos → stock de la variante, como un producto normal.
 *
 * La salida va por StockService y la devolución deshace lo que realmente salió: si la venta
 * dejó movimiento SALE de la variante, vuelve a la variante; si no, vuelve a los insumos.
 * Antes la anulación siempre sumaba a la variante (aunque la plantilla nunca la descontó) y
 * los insumos consumidos no volvían.
 */
class PosSaleStock
{
    public function __construct(
        private StockService $stock,
        private TemplateStockService $templateStock,
    ) {}

    /** ¿La línea se vende del stock propio de la variante? */
    public function fromVariant(ProductVariant $variant): bool
    {
        return ! $variant->product->isTemplate
            || $this->templateStock->stockSource($variant) === TemplateStockService::SOURCE_VARIANT;
    }

    /** Disponible de una plantilla que se vende de insumos (receta o insumo asociado). */
    public function availableFromInputs(ProductVariant $variant): float
    {
        return $this->templateStock->getAvailableStockForTemplate($variant->id);
    }

    /** Saca la línea vendida (dentro de la transacción de la venta). */
    public function out(Order $order, ProductVariant $variant, int $quantity, string $reason): void
    {
        $attrs = ['referenceType' => 'sale', 'referenceId' => $order->id, 'reason' => $reason];

        if ($this->fromVariant($variant)) {
            $this->stock->variantOut($variant->id, $quantity, 'SALE', $attrs);
            $this->stock->syncProductStock($variant->productId);

            return;
        }

        $templateReason = 'Venta POS - Template '.$variant->product->name;
        foreach ($this->inputConsumption($variant, $quantity) as $inputVariantId => $qty) {
            // El disponible ya se validó; el consumo de insumos no bloquea la venta.
            $this->stock->inputVariantOut($inputVariantId, $qty, 'SALIDA', array_merge($attrs, ['reason' => $templateReason]), allowNegative: true);
        }
    }

    /** Devuelve al inventario lo que salió con la línea (anulación, devolución o edición). */
    public function back(Order $order, int $variantId, int $quantity, string $reason, string $referenceType = 'sale'): void
    {
        $variant = ProductVariant::with('product')->find($variantId);
        if (! $variant) {
            return;
        }
        $attrs = ['referenceType' => $referenceType, 'referenceId' => $order->id, 'reason' => $reason];

        $soldFromVariant = ! $variant->product?->isTemplate || VariantMovement::where('variantId', $variantId)
            ->where('referenceType', 'sale')->where('referenceId', $order->id)
            ->where('movementType', 'SALE')->exists();

        if ($soldFromVariant) {
            $this->stock->variantIn($variantId, $quantity, 'RETURN', $attrs);
            $this->stock->syncProductStock($variant->productId);

            return;
        }

        foreach ($this->inputConsumption($variant, $quantity) as $inputVariantId => $qty) {
            $this->stock->inputVariantIn($inputVariantId, $qty, 'DEVOLUCION', $attrs);
        }
    }

    /**
     * Insumos que consume una plantilla por $quantity unidades: los de su receta o, si no
     * tiene, el insumo asociado que coincide en color/talla.
     *
     * @return array<int, float> inputVariantId => cantidad
     */
    private function inputConsumption(ProductVariant $variant, int $quantity): array
    {
        $out = [];
        $recipes = TemplateRecipe::where('variantId', $variant->id)->get();
        if ($recipes->isNotEmpty()) {
            foreach ($recipes as $recipe) {
                if (InputVariant::whereKey($recipe->inputVariantId)->exists()) {
                    $out[$recipe->inputVariantId] = ($out[$recipe->inputVariantId] ?? 0) + (float) $recipe->quantity * $quantity;
                }
            }

            return $out;
        }

        $match = $this->templateStock->matchingInputVariant($variant);

        return $match ? [$match->id => (float) $quantity] : [];
    }
}
