<?php

/*
| Carrito, pedidos, pagos y envíos.
| Incluido desde routes/api.php (prefijo /api); el orden de las rutas de cada prefijo se conserva.
*/

use App\Http\Controllers\CartController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ShippingController;
use Illuminate\Support\Facades\Route;

// ==================== CARRITO ====================
Route::prefix('cart')->middleware('auth:sanctum')->group(function () {
    Route::get('/', [CartController::class, 'index']);
    Route::delete('/', [CartController::class, 'clearCart']);
    Route::post('items', [CartController::class, 'addItem']);
    Route::put('items/{id}', [CartController::class, 'updateItem'])->whereNumber('id');
    Route::patch('items/{id}/customization', [CartController::class, 'updateItemCustomization'])->whereNumber('id');
    Route::delete('items/{id}', [CartController::class, 'removeItem'])->whereNumber('id');
    Route::post('sync', [CartController::class, 'syncCart']);
});

// ==================== PEDIDOS ====================
Route::prefix('orders')->middleware('auth:sanctum')->group(function () {
    // Usuario.
    Route::get('my', [OrderController::class, 'myOrders']);
    Route::get('my/number/{orderNumber}', [OrderController::class, 'myOrderByNumber']);
    Route::get('my/{id}', [OrderController::class, 'myOrderById'])->whereNumber('id');
    Route::post('my/{id}/cancel', [OrderController::class, 'cancelMyOrder'])->whereNumber('id');
    // Datos firmados por el servidor para abrir el widget de Wompi (monto y referencia del pedido).
    Route::post('my/{id}/wompi-checkout', [OrderController::class, 'wompiCheckout'])->whereNumber('id');
    Route::post('confirm-payment/{orderNumber}', [OrderController::class, 'confirmPayment']);
    Route::post('/', [OrderController::class, 'store']);

    // Panel.
    Route::middleware('permission:orders.view')->group(function () {
        Route::get('stats', [OrderController::class, 'stats']);
        Route::get('/', [OrderController::class, 'index']);
        Route::get('number/{orderNumber}', [OrderController::class, 'showByNumber']);
        Route::get('{id}', [OrderController::class, 'show'])->whereNumber('id');
        Route::patch('{id}/status', [OrderController::class, 'updateStatus'])->whereNumber('id');
    });
});

// ==================== PAGOS ====================
Route::prefix('payments')->middleware('auth:sanctum')->group(function () {
    Route::post('/', [PaymentController::class, 'store']);
    Route::post('mercadopago/preference', [PaymentController::class, 'mercadopagoPreference']);
    Route::get('order/{orderId}', [PaymentController::class, 'myOrderPayments'])->whereNumber('orderId');

    Route::middleware('permission:payments.view')->group(function () {
        Route::get('stats', [PaymentController::class, 'stats']);
        Route::get('all', [PaymentController::class, 'index']);
        Route::get('order/{orderId}/all', [PaymentController::class, 'orderPayments'])->whereNumber('orderId');
        Route::get('transaction/{transactionId}', [PaymentController::class, 'showByTransaction']);
        Route::get('{id}/admin', [PaymentController::class, 'show'])->whereNumber('id');
        Route::patch('{id}/admin', [PaymentController::class, 'update'])->whereNumber('id');
        Route::post('{id}/verify', [PaymentController::class, 'verify'])->whereNumber('id');
        Route::post('{id}/refund', [PaymentController::class, 'refund'])->whereNumber('id');
        Route::post('{id}/cancel', [PaymentController::class, 'cancel'])->whereNumber('id');
    });

    Route::patch('{id}', [PaymentController::class, 'updateMyPayment'])->whereNumber('id');
});

// ==================== ENVÍOS ====================
Route::prefix('shipping')->middleware(['auth:sanctum', 'permission:shipping.config,shipping.zones,shipping.carriers'])->group(function () {
    Route::post('sync-rates', [ShippingController::class, 'syncRates']);
});
