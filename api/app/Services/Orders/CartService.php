<?php

namespace App\Services\Orders;

use App\Exceptions\BusinessRuleException;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\ProductColor;
use App\Models\ProductVariant;
use App\Services\CustomizationPricingService;
use App\Services\DiscountService;
use App\Services\TemplateStockService;
use App\Support\ImageUrls;
use Illuminate\Validation\ValidationException;

/**
 * Carrito del usuario en el servidor.
 *
 * Reglas:
 *  - Un producto normal se agrega solo si existe, está activo y la variante es suya; la
 *    cantidad total de la línea no puede superar el stock (antes se aceptaba cualquier cosa).
 *    La misma combinación suma cantidad en la línea existente.
 *  - Los personalizados siempre van como línea nueva; en v2 el precio lo calcula el servidor
 *    (base con oferta + zonas). Su stock lo valida el pedido (receta o variante de la plantilla).
 *  - El precio que se muestra es el vigente (oferta automática), no el guardado.
 *  - Una línea que no es del carrito del usuario responde 404 (antes 500).
 */
class CartService
{
    public function __construct(
        private TemplateStockService $templateStock,
        private DiscountService $discounts,
        private CustomizationPricingService $customPricing,
    ) {}

    /** Líneas del carrito con precio vigente, stock disponible y datos del producto. */
    public function items(int $userId): array
    {
        $items = $this->cartFor($userId)->items()->orderBy('createdAt')->get();
        $autos = $this->discounts->activeAutoDiscounts('online');

        return $items->map(fn (CartItem $item) => $this->present($item, $autos))->all();
    }

    public function add(int $userId, array $data): CartItem
    {
        $cart = $this->cartFor($userId);

        if (! empty($data['isCustomized']) && ! empty($data['customization'])) {
            return CartItem::create([
                'cartId' => $cart->id,
                'productId' => $data['productId'] ?? null,
                'variantId' => $data['variantId'] ?? null,
                'isCustomized' => true,
                'customization' => $data['customization'],
                'quantity' => $data['quantity'],
                'unitPrice' => $this->customPricing->cartUnitPrice($data['customization']) ?? $data['unitPrice'],
            ]);
        }

        $productId = $data['productId'] ?? null;
        $variantId = $data['variantId'] ?? null;
        $available = $this->availableFor($productId, $variantId);

        $existing = CartItem::where('cartId', $cart->id)
            ->where('productId', $productId)
            ->where('variantId', $variantId)
            ->where('isCustomized', false)
            ->first();

        $total = ($existing?->quantity ?? 0) + $data['quantity'];
        $this->assertStock($total, $available);

        if ($existing) {
            $existing->quantity = $total;
            $existing->save();

            return $existing;
        }

        return CartItem::create([
            'cartId' => $cart->id,
            'productId' => $productId,
            'variantId' => $variantId,
            'isCustomized' => false,
            'quantity' => $data['quantity'],
            'unitPrice' => $data['unitPrice'],
        ]);
    }

    /** Cambia la cantidad; 0 o menos quita la línea (devuelve null). */
    public function updateQuantity(int $userId, int $itemId, int $quantity): ?CartItem
    {
        $item = $this->findItem($userId, $itemId);
        if ($quantity <= 0) {
            $item->delete();

            return null;
        }
        if (! $item->isCustomized && $quantity > $item->quantity) {
            $this->assertStock($quantity, $this->availableFor($item->productId, $item->variantId));
        }

        $item->quantity = $quantity;
        $item->save();

        return $item;
    }

    public function updateCustomization(int $userId, int $itemId, mixed $customization, float $unitPrice): CartItem
    {
        $item = CartItem::where('id', $itemId)->where('cartId', $this->cartFor($userId)->id)->where('isCustomized', true)->first();
        if (! $item) {
            throw new BusinessRuleException('Item personalizado no encontrado en el carrito', 404);
        }

        $item->customization = $customization;
        $item->unitPrice = $this->customPricing->cartUnitPrice($customization) ?? $unitPrice;
        $item->save();

        return $item;
    }

    public function remove(int $userId, int $itemId): void
    {
        $this->findItem($userId, $itemId)->delete();
    }

    public function clear(int $userId): void
    {
        Cart::where('userId', $userId)->first()?->items()->delete();
    }

    /**
     * Pasa al servidor el carrito guardado en el navegador (al iniciar sesión). Es tolerante:
     * no valida stock (la línea queda marcada sin stock) y omite productos que ya no existen.
     */
    public function sync(int $userId, array $items): array
    {
        $cart = $this->cartFor($userId);

        foreach ($items as $raw) {
            $isCustomized = (bool) ($raw['isCustomized'] ?? ! empty($raw['customization']));
            $productId = $raw['productId'] ?? ($raw['customization']['templateId'] ?? null);
            $variantId = $raw['variantId'] ?? null;
            $quantity = (int) ($raw['quantity'] ?? 1);
            $unitPrice = $raw['unitPrice'] ?? $raw['price'] ?? ($raw['customization']['price'] ?? 0);

            if ($isCustomized) {
                $customization = $raw['customization'] ?? $raw;
                try {
                    $unitPrice = $this->customPricing->cartUnitPrice($customization) ?? $unitPrice;
                } catch (ValidationException) {
                    // Zonas que ya no existen: se conserva el precio; el pedido lo vuelve a validar.
                }
                CartItem::create([
                    'cartId' => $cart->id,
                    'productId' => $productId,
                    'variantId' => $variantId,
                    'isCustomized' => true,
                    'customization' => $customization,
                    'quantity' => $quantity,
                    'unitPrice' => $unitPrice,
                ]);

                continue;
            }

            if ($productId && ! Product::whereKey($productId)->exists()) {
                continue;
            }

            $existing = CartItem::where('cartId', $cart->id)
                ->where('productId', $productId)
                ->where('variantId', $variantId)
                ->where('isCustomized', false)
                ->first();

            if ($existing) {
                $existing->quantity += $quantity;
                $existing->save();
            } else {
                CartItem::create([
                    'cartId' => $cart->id,
                    'productId' => $productId,
                    'variantId' => $variantId,
                    'isCustomized' => false,
                    'quantity' => $quantity,
                    'unitPrice' => $unitPrice,
                ]);
            }
        }

        return $this->items($userId);
    }

    // ==================== Utilidades ====================

    private function cartFor(int $userId): Cart
    {
        return Cart::firstOrCreate(['userId' => $userId]);
    }

    private function findItem(int $userId, int $itemId): CartItem
    {
        $item = CartItem::where('id', $itemId)->where('cartId', $this->cartFor($userId)->id)->first();
        if (! $item) {
            throw new BusinessRuleException('Item no encontrado en el carrito', 404);
        }

        return $item;
    }

    /** Stock disponible de un producto normal (de la variante si se indica). Valida que exista. */
    private function availableFor(?int $productId, ?int $variantId): int
    {
        $product = $productId ? Product::where('isActive', true)->find($productId) : null;
        if (! $product) {
            throw new BusinessRuleException('Producto no encontrado', 404);
        }
        if ($variantId === null) {
            return (int) $product->stock;
        }

        $variant = ProductVariant::where('productId', $product->id)->where('isActive', true)->find($variantId);
        if (! $variant) {
            throw new BusinessRuleException('Variante no encontrada', 404);
        }

        return (int) $variant->stock;
    }

    private function assertStock(int $requested, int $available): void
    {
        if ($requested > $available) {
            throw new BusinessRuleException(
                $available > 0 ? "Stock insuficiente. Disponible: {$available}" : 'Producto sin stock',
                400
            );
        }
    }

    private function present(CartItem $item, $autos): array
    {
        $availableStock = 0;
        $product = null;
        $variant = null;
        $effectivePrice = (float) $item->unitPrice;
        $pricing = null;

        if ($item->isCustomized && $item->customization) {
            $custom = $item->customization;
            if (! empty($custom['templateId'])) {
                // Precio vigente del diseño (v2: base con oferta + zonas). Si una zona dejó de
                // existir, se conserva el precio guardado; el pedido lo vuelve a validar.
                try {
                    $quote = $this->customPricing->cartQuote($custom, $autos);
                    if ($quote) {
                        $effectivePrice = $quote['total'];
                        // Desglose vigente para el carrito (el guardado en el ítem puede estar viejo).
                        $pricing = [
                            'basePrice' => $quote['basePrice'], 'listPrice' => $quote['listPrice'],
                            'customizationPrice' => $quote['customizationPrice'], 'total' => $quote['total'],
                        ];
                    }
                } catch (ValidationException) {
                }
                $tplVariant = $this->templateVariantFor($custom);
                if ($tplVariant) {
                    $availableStock = $this->templateStock->getAvailableStockForTemplate($tplVariant->id);
                }
            }
        } elseif ($item->variantId) {
            $v = ProductVariant::with(['product', 'color', 'size'])->find($item->variantId);
            if ($v) {
                $availableStock = $v->stock ?? 0;
                $sale = $this->discounts->autoPrice($v->product, $autos);
                if (! $item->isCustomized) {
                    $effectivePrice = $sale;
                }
                $product = $this->productInfo($v->product, $sale);
                // Imagen por color: si la variante tiene color con imagen, úsala.
                if ($v->colorId) {
                    $pc = ProductColor::where('productId', $v->product->id)->where('colorId', $v->colorId)->first();
                    $colorImg = $pc ? ImageUrls::forColor($pc->image, $pc->id, $v->product->updatedAt) : null;
                    if ($colorImg) {
                        $product['images']['front'] = $colorImg;
                    }
                }
                $variant = [
                    'id' => $v->id,
                    'colorName' => $v->color?->name ?? '',
                    'colorHex' => $v->color?->hexCode ?? '',
                    'sizeName' => $v->size?->name ?? '',
                    'sizeAbbreviation' => $v->size?->abbreviation ?? '',
                ];
            }
        } elseif ($item->productId) {
            $p = Product::find($item->productId);
            if ($p) {
                $availableStock = $p->stock ?? 0;
                $sale = $this->discounts->autoPrice($p, $autos);
                if (! $item->isCustomized) {
                    $effectivePrice = $sale;
                }
                $product = $this->productInfo($p, $sale);
            }
        }

        return [
            'id' => $item->id,
            'productId' => $item->productId,
            'variantId' => $item->variantId,
            'isCustomized' => $item->isCustomized,
            'customization' => $item->customization,
            'quantity' => $item->quantity,
            'unitPrice' => $effectivePrice,
            'pricing' => $pricing,
            'availableStock' => $availableStock,
            'hasStock' => $availableStock >= $item->quantity,
            'product' => $product,
            'variant' => $variant,
        ];
    }

    /** Variante de la plantilla de un personalizado: por ids (v2) o por color/talla (formato viejo). */
    private function templateVariantFor(array $custom): ?ProductVariant
    {
        $query = ProductVariant::where('productId', $custom['templateId']);
        $byIds = ! empty($custom['colorId']) && ! empty($custom['sizeId']);
        if ($byIds) {
            $query->where('colorId', $custom['colorId'])->where('sizeId', $custom['sizeId']);
        } elseif (! empty($custom['selectedColor'])) {
            $query->whereHas('color', fn ($q) => $q->where('hexCode', $custom['selectedColor']));
        }
        if (! $byIds && ! empty($custom['selectedSize'])) {
            $query->whereHas('size', fn ($q) => $q->where('name', $custom['selectedSize'])->orWhere('abbreviation', $custom['selectedSize']));
        }

        return $query->first();
    }

    private function productInfo(Product $p, float $sale): array
    {
        return [
            'id' => $p->id,
            'name' => $p->name,
            'description' => $p->description,
            'images' => $this->normalizeImages($p->images),
            'basePrice' => (float) $p->basePrice,
            'salePrice' => $sale,
            'hasDiscount' => $sale < (float) $p->basePrice,
        ];
    }

    /** Imágenes como {front, back, side, extra1, extra2}; acepta objeto o lista. */
    private function normalizeImages($images): array
    {
        if (is_string($images)) {
            $decoded = json_decode($images, true);
            $images = is_array($decoded) ? $decoded : [];
        }
        $images = is_array($images) ? $images : [];
        $get = fn ($key, $idx) => $images[$key] ?? ($images[$idx] ?? null);

        return [
            'front' => $get('front', 0),
            'back' => $get('back', 1),
            'side' => $get('side', 2),
            'extra1' => $get('extra1', 3),
            'extra2' => $get('extra2', 4),
        ];
    }
}
