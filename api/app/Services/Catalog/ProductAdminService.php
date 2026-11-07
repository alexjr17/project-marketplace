<?php

namespace App\Services\Catalog;

use App\Exceptions\BusinessRuleException;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductColor;
use App\Models\ProductSize;
use App\Models\ProductType;
use App\Models\ProductVariant;
use App\Services\NumberSequenceService;
use App\Services\VariantService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Alta, edición y baja de productos desde el panel: SKU y slug únicos, colores y tallas del
 * producto y sus variantes (que se generan en la misma transacción: si algo falla, no queda
 * un producto sin variantes), y qué productos no se pueden borrar.
 */
class ProductAdminService
{
    public function __construct(
        private VariantService $variants,
        private NumberSequenceService $numbers,
    ) {}

    public function create(array $data): Product
    {
        $colors = $this->colorsFrom($data);
        $sizeIds = $this->sizeIdsFrom($data);

        return DB::transaction(function () use ($data, $colors, $sizeIds) {
            $slug = $data['slug'] ?? Str::slug($data['name']);
            if (Product::where('slug', $slug)->exists()) {
                $slug .= '-'.strtolower(base_convert((string) now()->timestamp, 10, 36));
            }

            $product = Product::create([
                'sku' => $data['sku'] ?? $this->generateSku($data['typeId'] ?? null),
                'slug' => $slug,
                'name' => $data['name'],
                'description' => $data['description'],
                'categoryId' => $data['categoryId'] ?? null,
                'typeId' => $data['typeId'] ?? null,
                'basePrice' => $data['basePrice'],
                'stock' => $data['stock'] ?? 0,
                'featured' => $data['featured'] ?? false,
                'isActive' => $data['isActive'] ?? true,
                'isTemplate' => $data['isTemplate'] ?? false,
                'images' => $data['images'] ?? [],
                'tags' => $data['tags'] ?? [],
            ]);
            $this->writeColors($product, $colors);
            $this->writeSizes($product, $sizeIds);

            // Siempre se generan variantes. Con color/talla se crean las combinaciones (stock
            // inicial 0, se ajusta luego). Sin color/talla se crea UNA variante simple
            // [null, null] con el stock del producto, para que sea vendible.
            $initialStock = ($colors || $sizeIds) ? 0 : (int) ($data['stock'] ?? 0);
            $this->variants->generateVariantsForProduct($product->id, $initialStock);

            return $product;
        });
    }

    /**
     * Edita el producto. Si llega la clave 'colors' o 'sizes' (aunque sea []), reemplaza el set
     * completo y regenera las variantes que falten; si no llega, no se tocan.
     */
    public function update(Product $product, array $data): Product
    {
        $colors = $this->colorsFrom($data);
        $sizeIds = $this->sizeIdsFrom($data);

        DB::transaction(function () use ($product, $data, $colors, $sizeIds) {
            foreach (['name', 'description', 'categoryId', 'typeId', 'basePrice', 'stock',
                'featured', 'isActive', 'isTemplate', 'images', 'tags'] as $field) {
                if (array_key_exists($field, $data) && $data[$field] !== null) {
                    $product->{$field} = $data[$field];
                }
            }
            $product->save();

            $variantsNeedUpdate = false;
            if (array_key_exists('colors', $data)) {
                ProductColor::where('productId', $product->id)->delete();
                $this->writeColors($product, $colors);
                $variantsNeedUpdate = true;
            }
            if (array_key_exists('sizes', $data)) {
                ProductSize::where('productId', $product->id)->delete();
                $this->writeSizes($product, $sizeIds);
                $variantsNeedUpdate = true;
            }

            if ($variantsNeedUpdate) {
                // Sin color/talla (producto simple) la variante [null,null] toma el stock del
                // producto; con variantes, stock inicial 0 (se ajusta luego).
                $initialStock = ($colors || $sizeIds) ? 0 : (int) ($product->stock ?? 0);
                $this->variants->generateVariantsForProduct($product->id, $initialStock);
            }
        });

        return $product;
    }

    /** Solo se borra un producto sin pedidos ni variantes con ventas, movimientos o recetas. */
    public function delete(Product $product): void
    {
        if (OrderItem::where('productId', $product->id)->exists()) {
            throw new BusinessRuleException(
                'No se puede eliminar el producto porque tiene pedidos asociados. Desactívalo en su lugar.',
                400
            );
        }

        $hasRelations = ProductVariant::where('productId', $product->id)
            ->where(function ($q) {
                $q->whereHas('orderItems')
                    ->orWhereHas('movements')
                    ->orWhereHas('templateRecipes');
            })
            ->exists();
        if ($hasRelations) {
            throw new BusinessRuleException(
                'No se puede eliminar el producto porque tiene variantes con ventas, movimientos de inventario o recetas asociadas. Desactívalo en su lugar.',
                400
            );
        }

        $product->delete();
    }

    /** Ajusta products.stock: fija, suma o resta. No puede quedar negativo. */
    public function updateStock(Product $product, int $quantity, string $operation = 'set'): Product
    {
        $newStock = match ($operation) {
            'add' => $product->stock + $quantity,
            'subtract' => $product->stock - $quantity,
            default => $quantity,
        };
        if ($newStock < 0) {
            throw new BusinessRuleException('El stock no puede ser negativo', 400);
        }

        $product->stock = $newStock;
        $product->save();

        return $product;
    }

    /** Colores con id (con su imagen opcional). */
    private function colorsFrom(array $data): array
    {
        return collect($data['colors'] ?? [])->filter(fn ($c) => ! empty($c['id']))->values()->all();
    }

    private function sizeIdsFrom(array $data): array
    {
        return collect($data['sizes'] ?? [])->pluck('id')->filter()->values()->all();
    }

    private function writeColors(Product $product, array $colors): void
    {
        foreach ($colors as $c) {
            ProductColor::create([
                'productId' => $product->id,
                'colorId' => $c['id'],
                'image' => $c['image'] ?? null,
            ]);
        }
    }

    private function writeSizes(Product $product, array $sizeIds): void
    {
        foreach ($sizeIds as $sizeId) {
            ProductSize::create(['productId' => $product->id, 'sizeId' => $sizeId]);
        }
    }

    /** SKU de producto: PREFIJO-NNNN-TIMESTAMP (prefijo = 3 letras del tipo, o PRD). */
    private function generateSku(?int $typeId): string
    {
        $prefix = 'PRD';
        if ($typeId) {
            $slug = ProductType::where('id', $typeId)->value('slug');
            if ($slug) {
                $prefix = strtoupper(substr($slug, 0, 3));
            }
        }
        // Consecutivo global atómico; nunca por debajo de la cantidad de productos.
        $count = $this->numbers->nextValue(NumberSequenceService::PRODUCT_SKU, fn () => Product::count());
        $timestamp = strtoupper(base_convert((string) (now()->timestamp * 1000), 10, 36));

        return $prefix.'-'.str_pad((string) $count, 4, '0', STR_PAD_LEFT).'-'.$timestamp;
    }
}
