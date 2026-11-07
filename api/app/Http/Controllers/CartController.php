<?php

namespace App\Http\Controllers;

use App\Services\Orders\CartService;
use Illuminate\Http\Request;

/**
 * Carrito del usuario. La lógica vive en Orders\CartService.
 * Respuestas con su forma propia: { success, items } y { success, item }.
 */
class CartController extends Controller
{
    public function __construct(private CartService $cart) {}

    public function index(Request $request)
    {
        return response()->json(['success' => true, 'items' => $this->cart->items($request->user()->id)]);
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

        return response()->json(['success' => true, 'item' => $this->cart->add($request->user()->id, $data)], 201);
    }

    public function updateItem(Request $request, int $id)
    {
        $data = $request->validate(['quantity' => 'required|integer']);

        return response()->json(['success' => true, 'item' => $this->cart->updateQuantity($request->user()->id, $id, $data['quantity'])]);
    }

    public function updateItemCustomization(Request $request, int $id)
    {
        $data = $request->validate([
            'customization' => 'required',
            'unitPrice' => 'required|numeric|min:0',
        ]);

        return response()->json([
            'success' => true,
            'item' => $this->cart->updateCustomization($request->user()->id, $id, $data['customization'], (float) $data['unitPrice']),
        ]);
    }

    public function removeItem(Request $request, int $id)
    {
        $this->cart->remove($request->user()->id, $id);

        return response()->json(['success' => true, 'message' => 'Item eliminado']);
    }

    public function clearCart(Request $request)
    {
        $this->cart->clear($request->user()->id);

        return response()->json(['success' => true, 'message' => 'Carrito vaciado']);
    }

    public function syncCart(Request $request)
    {
        $data = $request->validate(['items' => 'required|array']);

        return response()->json(['success' => true, 'items' => $this->cart->sync($request->user()->id, $data['items'])]);
    }
}
