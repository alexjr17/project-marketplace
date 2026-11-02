<?php

/*
| Compras: órdenes de compra, devoluciones y proveedores.
| Incluido desde routes/api.php (prefijo /api); el orden de las rutas de cada prefijo se conserva.
*/

use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\PurchaseReturnController;
use App\Http\Controllers\SupplierController;
use Illuminate\Support\Facades\Route;

// ==================== ÓRDENES DE COMPRA ====================
Route::prefix('purchase-orders')->middleware('auth:sanctum')->group(function () {
    Route::get('stats', [PurchaseOrderController::class, 'stats'])->middleware('permission:purchase_orders.view');
    Route::get('generate-number', [PurchaseOrderController::class, 'generateNumber'])->middleware('permission:purchase_orders.view');
    Route::get('/', [PurchaseOrderController::class, 'index'])->middleware('permission:purchase_orders.view');
    Route::get('{id}', [PurchaseOrderController::class, 'show'])->whereNumber('id')->middleware('permission:purchase_orders.view');
    Route::post('/', [PurchaseOrderController::class, 'store'])->middleware('permission:purchase_orders.view');
    Route::put('{id}', [PurchaseOrderController::class, 'update'])->whereNumber('id')->middleware('permission:purchase_orders.view');
    Route::patch('{id}/status', [PurchaseOrderController::class, 'updateStatus'])->whereNumber('id')->middleware('permission:purchase_orders.view');
    Route::post('{id}/receive', [PurchaseOrderController::class, 'receive'])->whereNumber('id')->middleware('permission:purchase_orders.view');
    // Eliminar una orden de compra: solo el administrador (SuperAdmin).
    Route::delete('{id}', [PurchaseOrderController::class, 'destroy'])->whereNumber('id')->middleware('permission:purchase_orders.view');
});

// ==================== DEVOLUCIONES DE COMPRA ====================
Route::prefix('purchase-returns')->middleware('auth:sanctum')->group(function () {
    Route::get('stats', [PurchaseReturnController::class, 'stats'])->middleware('permission:purchase_returns.view');
    Route::get('generate-number', [PurchaseReturnController::class, 'generateNumber'])->middleware('permission:purchase_returns.view');
    Route::get('returnable/{purchaseOrderId}', [PurchaseReturnController::class, 'returnableItems'])
        ->whereNumber('purchaseOrderId')->middleware('permission:purchase_returns.view');
    Route::get('/', [PurchaseReturnController::class, 'index'])->middleware('permission:purchase_returns.view');
    Route::get('{id}', [PurchaseReturnController::class, 'show'])->whereNumber('id')->middleware('permission:purchase_returns.view');
    Route::post('/', [PurchaseReturnController::class, 'store'])->middleware('permission:purchase_returns.view');
});

// ==================== PROVEEDORES ====================
Route::prefix('suppliers')->middleware('auth:sanctum')->group(function () {
    Route::get('stats', [SupplierController::class, 'stats'])->middleware('permission:suppliers.view');
    Route::get('generate-code', [SupplierController::class, 'generateCode'])->middleware('permission:suppliers.view');
    Route::get('/', [SupplierController::class, 'index'])->middleware('permission:suppliers.view');
    Route::get('{id}', [SupplierController::class, 'show'])->whereNumber('id')->middleware('permission:suppliers.view');
    Route::post('/', [SupplierController::class, 'store'])->middleware('permission:suppliers.view');
    Route::put('{id}', [SupplierController::class, 'update'])->whereNumber('id')->middleware('permission:suppliers.view');
    Route::delete('{id}', [SupplierController::class, 'destroy'])->whereNumber('id')->middleware('permission:suppliers.view');
});
