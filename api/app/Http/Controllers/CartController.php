<?php

namespace App\Http\Controllers;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\TemplateStockService;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function __construct(private TemplateStockService $templateStock) {}

    /** Obtiene o crea el carrito del usuario. */
    private function cartFor(int $userId): Cart
    {
        return Cart::firstOrCreate(['userId' => $userId]);
    }

    /** Normaliza el objeto de imágenes a {front,back,side,extra1,extra2}.
     *  Soporta objeto {front,...} y lista numérica ['data:...', ...]. */
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

    /** Construye la lista de items del carrito con validación de stock. */
    private function cartItemsWithStock(int $userId): array
    {
        $cart = $this->cartFor($userId);
        $items = $cart->items()->orderBy('createdAt')->get();

        $result = [];
        foreach ($items as $item) {
            $availableStock = 0;
            $product = null;
            $variant = null;

            if ($item->isCustomized && $item->customization) {
                $custom = $item->customization;
                if (! empty($custom['templateId'])) {
                    $query = ProductVariant::where('productId', $custom['templateId']);
                    if (! empty($custom['selectedColor'])) {
                        $query->whereHas('color', fn ($q) => $q->where('hexCode', $custom['selectedColor']));
                    }
                    if (! empty($custom['selectedSize'])) {
                        $query->whereHas('size', fn ($q) => $q->where('name', $custom['selectedSize'])
                            ->orWhere('abbreviation', $custom['selectedSize']));
                    }
                    $tplVariant = $query->first();
                    if ($tplVariant) {
                        $availableStock = $this->templateStock->getAvailableStockForTemplate($tplVariant->id);
                    }
                }
            } elseif ($item->variantId) {
                $v = ProductVariant::with(['product', 'color', 'size'])->find($item->variantId);
                if ($v) {
                    $availableStock = $v->stock ?? 0;
                    $product = [
                        'id' => $v->product->id,
                        'name' => $v->product->name,
                        'description' => $v->product->description,
                        'images' => $this->normalizeImages($v->product->images),
                        'basePrice' => (float) $v->product->basePrice,
                    ];
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
                    $product = [
                        'id' => $p->id,
                        'name' => $p->name,
                        'description' => $p->description,
                        'images' => $this->normalizeImages($p->images),
                        'basePrice' => (float) $p->basePrice,
                    ];
                }
            }

            $result[] = [
                'id' => $item->id,
                'productId' => $item->productId,
                'variantId' => $item->variantId,
                'isCustomized' => $item->isCustomized,
                'customization' => $item->customization,
                'quantity' => $item->quantity,
                'unitPrice' => (float) $item->unitPrice,
                'availableStock' => $availableStock,
                'hasStock' => $availableStock >= $item->quantity,
                'product' => $product,
                'variant' => $variant,
            ];
        }

        return $result;
    }

    public function index(Request $request)
    {
        return response()->json([
            'success' => true,
            'items' => $this->cartItemsWithStock($request->user()->id),
        ]);
    }

    public function addItem(Request $request)
    {
        $data = $request->validate([
            'productId' => 'nullable|integer',
            'variantId' => 'nullable|integer',
            'isCustomized' => 'nullable|boolean',
            'customization' => 'nullable',
            'quantity' => 'required|integer|min:1',
            'unitPrice' => 'required|numeric|min:0',
        ]);

        $cart = $this->cartFor($request->user()->id);
        $isCustomized = (bool) ($data['isCustomized'] ?? false);

        if ($isCustomized && ! empty($data['customization'])) {
            // Los personalizados siempre se agregan como item nuevo.
            $item = CartItem::create([
                'cartId' => $cart->id,
                'productId' => $data['productId'] ?? null,
                'variantId' => $data['variantId'] ?? null,
                'isCustomized' => true,
                'customization' => $data['customization'],
                'quantity' => $data['quantity'],
                'unitPrice' => $data['unitPrice'],
            ]);

            return response()->json(['success' => true, 'item' => $item], 201);
        }

        // Producto normal: si ya existe la misma combinación, suma cantidad.
        $existing = CartItem::where('cartId', $cart->id)
            ->where('productId', $data['productId'] ?? null)
            ->where('variantId', $data['variantId'] ?? null)
            ->where('isCustomized', false)
            ->first();

        if ($existing) {
            $existing->quantity += $data['quantity'];
            $existing->save();

            return response()->json(['success' => true, 'item' => $existing], 201);
        }

        $item = CartItem::create([
            'cartId' => $cart->id,
            'productId' => $data['productId'] ?? null,
            'variantId' => $data['variantId'] ?? null,
            'isCustomized' => false,
            'quantity' => $data['quantity'],
            'unitPrice' => $data['unitPrice'],
        ]);

        return response()->json(['success' => true, 'item' => $item], 201);
    }

    public function updateItem(Request $request, int $id)
    {
        $data = $request->validate(['quantity' => 'required|integer']);

        $cart = $this->cartFor($request->user()->id);
        $item = CartItem::where('id', $id)->where('cartId', $cart->id)->first();
        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Item no encontrado en el carrito'], 500);
        }

        if ($data['quantity'] <= 0) {
            $item->delete();

            return response()->json(['success' => true, 'item' => null]);
        }

        $item->quantity = $data['quantity'];
        $item->save();

        return response()->json(['success' => true, 'item' => $item]);
    }

    public function updateItemCustomization(Request $request, int $id)
    {
        $data = $request->validate([
            'customization' => 'required',
            'unitPrice' => 'required|numeric|min:0',
        ]);

        $cart = $this->cartFor($request->user()->id);
        $item = CartItem::where('id', $id)->where('cartId', $cart->id)->where('isCustomized', true)->first();
        if (! $item) {
            return response()->json([
                'success' => false,
                'message' => 'Item personalizado no encontrado en el carrito',
            ], 500);
        }

        $item->customization = $data['customization'];
        $item->unitPrice = $data['unitPrice'];
        $item->save();

        return response()->json(['success' => true, 'item' => $item]);
    }

    public function removeItem(Request $request, int $id)
    {
        $cart = $this->cartFor($request->user()->id);
        $item = CartItem::where('id', $id)->where('cartId', $cart->id)->first();
        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Item no encontrado en el carrito'], 500);
        }

        $item->delete();

        return response()->json(['success' => true, 'message' => 'Item eliminado']);
    }

    public function clearCart(Request $request)
    {
        $cart = Cart::where('userId', $request->user()->id)->first();
        if ($cart) {
            $cart->items()->delete();
        }

        return response()->json(['success' => true, 'message' => 'Carrito vaciado']);
    }

    public function syncCart(Request $request)
    {
        $data = $request->validate(['items' => 'required|array']);
        $cart = $this->cartFor($request->user()->id);

        foreach ($data['items'] as $raw) {
            $isCustomized = (bool) ($raw['isCustomized'] ?? ! empty($raw['customization']));
            $productId = $raw['productId'] ?? ($raw['customization']['templateId'] ?? null);
            $variantId = $raw['variantId'] ?? null;
            $quantity = (int) ($raw['quantity'] ?? 1);
            $unitPrice = $raw['unitPrice'] ?? $raw['price'] ?? ($raw['customization']['price'] ?? 0);

            if ($isCustomized) {
                CartItem::create([
                    'cartId' => $cart->id,
                    'productId' => $productId,
                    'variantId' => $variantId,
                    'isCustomized' => true,
                    'customization' => $raw['customization'] ?? $raw,
                    'quantity' => $quantity,
                    'unitPrice' => $unitPrice,
                ]);

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

        return response()->json([
            'success' => true,
            'items' => $this->cartItemsWithStock($request->user()->id),
        ]);
    }
}
