<?php

namespace App\Services;

use App\Models\Color;
use App\Models\Product;
use App\Models\ProductInput;
use App\Models\ProductVariant;
use App\Models\Size;
use RuntimeException;

/**
 * Lógica de variantes de producto: generación de SKU, códigos de barras
 * EAN-13 y creación automática de variantes (color × talla).
 */
class VariantService
{
    /** Genera un código EAN-13 válido (con dígito verificador). */
    public function generateEan13(): string
    {
        $random = str_pad((string) random_int(0, 999999999999), 12, '0', STR_PAD_LEFT);

        $sum = 0;
        for ($i = 0; $i < 12; $i++) {
            $digit = (int) $random[$i];
            $sum += $i % 2 === 0 ? $digit : $digit * 3;
        }
        $check = (10 - ($sum % 10)) % 10;

        return $random.$check;
    }

    /** Genera un código de barras EAN-13 que no exista aún. */
    public function generateUniqueBarcode(): ?string
    {
        for ($i = 0; $i < 10; $i++) {
            $barcode = $this->generateEan13();
            if (! ProductVariant::where('barcode', $barcode)->exists()) {
                return $barcode;
            }
        }

        return null;
    }

    /** Construye el SKU de una variante según tenga color y/o talla. */
    public function generateSku(string $productSku, ?string $colorSlug, ?string $sizeAbbr): string
    {
        if ($colorSlug && $sizeAbbr) {
            $sku = "{$productSku}-{$sizeAbbr}-".strtoupper($colorSlug);
        } elseif ($colorSlug) {
            $sku = "{$productSku}-".strtoupper($colorSlug);
        } elseif ($sizeAbbr) {
            $sku = "{$productSku}-{$sizeAbbr}";
        } else {
            $sku = "{$productSku}-UNICO";
        }

        return substr($sku, 0, 255);
    }

    /** Crea una variante de producto. */
    public function createVariant(array $data): ProductVariant
    {
        $product = Product::find($data['productId']);
        if (! $product) {
            throw new RuntimeException('Producto no encontrado');
        }

        $colorId = $data['colorId'] ?? null;
        $sizeId = $data['sizeId'] ?? null;
        $color = $colorId ? Color::find($colorId) : null;
        $size = $sizeId ? Size::find($sizeId) : null;

        $exists = ProductVariant::where('productId', $data['productId'])
            ->where('colorId', $colorId)
            ->where('sizeId', $sizeId)
            ->exists();
        if ($exists) {
            throw new RuntimeException('Ya existe una variante con esta combinación');
        }

        $sku = $data['sku'] ?? $this->generateSku($product->sku, $color?->slug, $size?->abbreviation);
        if (ProductVariant::where('sku', $sku)->exists()) {
            throw new RuntimeException('El SKU ya existe');
        }

        $barcode = $data['barcode'] ?? $this->generateUniqueBarcode();

        return ProductVariant::create([
            'productId' => $data['productId'],
            'colorId' => $colorId,
            'sizeId' => $sizeId,
            'sku' => $sku,
            'barcode' => $barcode,
            'stock' => $data['stock'] ?? 0,
            'minStock' => $data['minStock'] ?? 0,
            'priceAdjustment' => $data['priceAdjustment'] ?? null,
            'isActive' => true,
        ]);
    }

    /**
     * Genera todas las variantes de un producto según sus colores y tallas.
     * 4 casos: color×talla, solo color, solo talla, o variante única.
     */
    public function generateVariantsForProduct(int $productId, int $initialStock = 0): array
    {
        $product = Product::with(['productColors', 'productSizes'])->find($productId);
        if (! $product) {
            throw new RuntimeException('Producto no encontrado');
        }

        $colorIds = $product->productColors->pluck('colorId')->all();
        $sizeIds = $product->productSizes->pluck('sizeId')->all();

        $combos = [];
        if ($colorIds && $sizeIds) {
            foreach ($colorIds as $c) {
                foreach ($sizeIds as $s) {
                    $combos[] = [$c, $s];
                }
            }
        } elseif ($colorIds) {
            foreach ($colorIds as $c) {
                $combos[] = [$c, null];
            }
        } elseif ($sizeIds) {
            foreach ($sizeIds as $s) {
                $combos[] = [null, $s];
            }
        } else {
            $combos[] = [null, null];
        }

        $created = [];
        foreach ($combos as [$colorId, $sizeId]) {
            $existing = ProductVariant::where('productId', $productId)
                ->where('colorId', $colorId)
                ->where('sizeId', $sizeId)
                ->first();
            if ($existing) {
                // Si la combinación es válida pero estaba desactivada (p. ej. se
                // volvió a agregar ese color/talla), se reactiva.
                if (! $existing->isActive) {
                    $existing->isActive = true;
                    $existing->save();
                }
                continue;
            }
            try {
                $created[] = $this->createVariant([
                    'productId' => $productId,
                    'colorId' => $colorId,
                    'sizeId' => $sizeId,
                    'stock' => $initialStock,
                ]);
            } catch (\Throwable $e) {
                // Igual que el Node: se ignoran errores de combinaciones individuales.
            }
        }

        // Desactivar las variantes que ya NO corresponden a la configuración
        // actual de color/talla (p. ej. al convertir el producto en simple).
        // No se eliminan para preservar ventas/movimientos; solo se ocultan.
        ProductVariant::where('productId', $productId)
            ->where('isActive', true)
            ->get()
            ->each(function (ProductVariant $v) use ($colorIds, $sizeIds) {
                $colorOk = $colorIds ? in_array($v->colorId, $colorIds) : is_null($v->colorId);
                $sizeOk = $sizeIds ? in_array($v->sizeId, $sizeIds) : is_null($v->sizeId);
                if (! ($colorOk && $sizeOk)) {
                    $v->isActive = false;
                    $v->save();
                }
            });

        return $created;
    }

    // ==================== CONSULTAS ====================

    /** Convierte una variante a array con product/color/size y finalPrice. */
    public function withFinalPrice(ProductVariant $variant): array
    {
        $variant->loadMissing(['product', 'color', 'size']);
        $arr = $variant->toArray();

        $base = (float) ($variant->product->basePrice ?? 0);
        $adj = $variant->priceAdjustment !== null ? (float) $variant->priceAdjustment : 0;
        $arr['finalPrice'] = $base + $adj;

        return $arr;
    }

    /**
     * Para una colección de variantes, calcula el stock de las que son
     * de plantillas (template) a partir del stock de sus insumos.
     */
    private function applyTemplateStock($variants, bool $templateBaseZero = false): array
    {
        $templateIds = $variants->filter(fn ($v) => $v->product?->isTemplate)
            ->pluck('productId')->unique()->values()->all();

        $inputVariantsByProduct = [];
        if ($templateIds) {
            $productInputs = ProductInput::whereIn('productId', $templateIds)
                ->with(['input.variants' => fn ($q) => $q->where('isActive', true)])
                ->get();
            foreach ($productInputs as $pi) {
                $current = $inputVariantsByProduct[$pi->productId] ?? [];
                foreach ($pi->input?->variants ?? [] as $iv) {
                    $current[] = $iv;
                }
                $inputVariantsByProduct[$pi->productId] = $current;
            }
        }

        return $variants->map(function ($variant) use ($inputVariantsByProduct, $templateBaseZero) {
            $arr = $this->withFinalPrice($variant);
            $calculated = $variant->stock;

            if ($variant->product?->isTemplate) {
                $ivs = $inputVariantsByProduct[$variant->productId] ?? [];
                if ($ivs) {
                    $match = null;
                    foreach ($ivs as $iv) {
                        $colorMatch = $variant->colorId === null || $iv->colorId === $variant->colorId;
                        $sizeMatch = $variant->sizeId === null || $iv->sizeId === $variant->sizeId;
                        if ($colorMatch && $sizeMatch) {
                            $match = $iv;
                            break;
                        }
                    }
                    $calculated = $match ? (float) $match->currentStock : 0;
                } elseif ($templateBaseZero) {
                    $calculated = 0;
                }
            }

            $arr['stock'] = $calculated;

            return $arr;
        })->all();
    }

    /** Lista variantes con filtros (y stock calculado para templates). */
    public function getVariants(array $filter): array
    {
        $query = ProductVariant::with(['product', 'color', 'size']);

        if (! empty($filter['productId'])) {
            $query->where('productId', $filter['productId']);
        }
        if (! empty($filter['colorId'])) {
            $query->where('colorId', $filter['colorId']);
        }
        if (! empty($filter['sizeId'])) {
            $query->where('sizeId', $filter['sizeId']);
        }
        if (array_key_exists('isActive', $filter)) {
            $query->where('isActive', $filter['isActive']);
        }

        $variants = $query->orderBy('productId')->orderBy('colorId')->orderBy('sizeId')->get();
        $result = $this->applyTemplateStock($variants);

        if (! empty($filter['lowStock'])) {
            $result = array_values(array_filter($result, fn ($v) => $v['stock'] <= $v['minStock']));
        }

        return $result;
    }

    /** Variantes de productos (no templates), paginadas. */
    public function getProductVariants(array $filter): array
    {
        return $this->paginatedVariants($filter, false);
    }

    /** Variantes de plantillas, paginadas, con stock calculado. */
    public function getTemplateVariants(array $filter): array
    {
        return $this->paginatedVariants($filter, true);
    }

    private function paginatedVariants(array $filter, bool $templates): array
    {
        $page = max(1, (int) ($filter['page'] ?? 1));
        $limit = max(1, (int) ($filter['limit'] ?? 10));

        $query = ProductVariant::with(['product', 'color', 'size'])
            ->whereHas('product', fn ($q) => $q->where('isTemplate', $templates));

        if (! empty($filter['productId'])) {
            $query->where('productId', $filter['productId']);
        }
        if (! empty($filter['colorId'])) {
            $query->where('colorId', $filter['colorId']);
        }
        if (! empty($filter['sizeId'])) {
            $query->where('sizeId', $filter['sizeId']);
        }
        if (array_key_exists('isActive', $filter)) {
            $query->where('isActive', $filter['isActive']);
        }
        if (! empty($filter['search'])) {
            $s = $filter['search'];
            $query->where(function ($q) use ($s) {
                $q->where('sku', 'like', "%{$s}%")
                    ->orWhereHas('product', fn ($q2) => $q2->where('name', 'like', "%{$s}%"))
                    ->orWhereHas('color', fn ($q2) => $q2->where('name', 'like', "%{$s}%"));
            });
        }

        $total = $query->count();
        $variants = $query->orderBy('productId')->orderBy('colorId')->orderBy('sizeId')
            ->skip(($page - 1) * $limit)->take($limit)->get();

        $data = $templates
            ? $this->applyTemplateStock($variants, true)
            : $variants->map(fn ($v) => $this->withFinalPrice($v))->all();

        return [
            'data' => $data,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'totalPages' => (int) ceil($total / $limit),
            ],
        ];
    }

    public function getVariantById(int $id): ?array
    {
        $variant = ProductVariant::with(['product', 'color', 'size'])->find($id);

        return $variant ? $this->withFinalPrice($variant) : null;
    }

    public function getVariantByBarcode(string $barcode): ?array
    {
        $variant = ProductVariant::with(['product.category', 'product.productType', 'color', 'size'])
            ->where('barcode', $barcode)->first();

        return $variant ? $this->withFinalPrice($variant) : null;
    }

    public function getVariantBySku(string $sku): ?array
    {
        $variant = ProductVariant::with(['product', 'color', 'size'])->where('sku', $sku)->first();

        return $variant ? $this->withFinalPrice($variant) : null;
    }

    public function getVariantByProductColorSize(int $productId, string $colorHex, string $sizeName): ?array
    {
        $query = ProductVariant::with(['product', 'color', 'size'])
            ->where('productId', $productId)
            ->where('isActive', true);

        // Color: vacío = producto simple (sin color → colorId null).
        if ($colorHex === '') {
            $query->whereNull('colorId');
        } else {
            $color = Color::where('hexCode', $colorHex)->first();
            if (! $color) {
                return null;
            }
            $query->where('colorId', $color->id);
        }

        // Talla: vacío = producto simple (sin talla → sizeId null).
        if ($sizeName === '') {
            $query->whereNull('sizeId');
        } else {
            $size = Size::where('name', $sizeName)->orWhere('abbreviation', $sizeName)->first();
            if (! $size) {
                return null;
            }
            $query->where('sizeId', $size->id);
        }

        $variant = $query->first();

        return $variant ? $this->withFinalPrice($variant) : null;
    }

    public function updateVariant(int $id, array $data): ProductVariant
    {
        $variant = ProductVariant::find($id);
        if (! $variant) {
            throw new RuntimeException('Variante no encontrada');
        }

        if (! empty($data['sku']) && $data['sku'] !== $variant->sku
            && ProductVariant::where('sku', $data['sku'])->exists()) {
            throw new RuntimeException('El SKU ya existe');
        }
        if (! empty($data['barcode']) && $data['barcode'] !== $variant->barcode
            && ProductVariant::where('barcode', $data['barcode'])->exists()) {
            throw new RuntimeException('El código de barras ya existe');
        }

        foreach (['sku', 'barcode', 'stock', 'minStock', 'priceAdjustment', 'isActive'] as $field) {
            if (array_key_exists($field, $data)) {
                $variant->{$field} = $data[$field];
            }
        }
        $variant->save();

        return $variant->load(['product', 'color', 'size']);
    }

    public function deleteVariant(int $id): void
    {
        $variant = ProductVariant::withCount(['orderItems', 'movements', 'templateRecipes'])->find($id);
        if (! $variant) {
            throw new RuntimeException('Variante no encontrada');
        }

        if ($variant->order_items_count > 0 || $variant->movements_count > 0 || $variant->template_recipes_count > 0) {
            throw new RuntimeException(
                'No se puede eliminar la variante porque tiene ventas, movimientos de inventario o recetas asociadas. Desactívala en su lugar.'
            );
        }

        $variant->delete();
    }

    public function adjustStock(int $id, int $quantity): ProductVariant
    {
        $variant = ProductVariant::find($id);
        if (! $variant) {
            throw new RuntimeException('Variante no encontrada');
        }

        $newStock = $variant->stock + $quantity;
        if ($newStock < 0) {
            throw new RuntimeException('Stock insuficiente');
        }

        $variant->stock = $newStock;
        $variant->save();

        return $variant->load(['product', 'color', 'size']);
    }

    /** Variantes con stock por debajo del mínimo. */
    public function checkLowStock(): array
    {
        return ProductVariant::with(['product:id,name', 'color:id,name', 'size:id,name'])
            ->whereColumn('stock', '<=', 'minStock')
            ->where('isActive', true)
            ->whereNotNull('colorId')
            ->whereNotNull('sizeId')
            ->orderBy('stock')
            ->get()
            ->map(fn ($v) => $v->toArray() + [
                'productName' => $v->product?->name,
                'colorName' => $v->color?->name,
                'sizeName' => $v->size?->name,
            ])
            ->all();
    }
}
