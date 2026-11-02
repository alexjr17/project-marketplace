<?php

/*
| Cajas registradoras y punto de venta (POS).
| Incluido desde routes/api.php (prefijo /api); el orden de las rutas de cada prefijo se conserva.
*/

use App\Http\Controllers\CashRegisterController;
use App\Http\Controllers\POSController;
use Illuminate\Support\Facades\Route;

// ==================== CAJAS REGISTRADORAS ====================
Route::prefix('cash-registers')->middleware('auth:sanctum')->group(function () {
    Route::get('/', [CashRegisterController::class, 'index'])->middleware('permission:pos.cash_register,pos.access');
    Route::get('my-session', [CashRegisterController::class, 'mySession'])->middleware('permission:pos.access');
    // Sesiones — antes de /{id} para evitar conflictos de ruta.
    Route::get('sessions', [CashRegisterController::class, 'listSessions'])->middleware('permission:pos.view_reports,pos.cash_register');
    Route::get('sessions/{id}/report', [CashRegisterController::class, 'sessionReport'])
        ->whereNumber('id')->middleware('permission:pos.view_reports,pos.cash_register');
    Route::post('sessions/{id}/close', [CashRegisterController::class, 'closeSession'])
        ->whereNumber('id')->middleware('permission:pos.open_close_session,pos.access');
    Route::get('{id}', [CashRegisterController::class, 'show'])->whereNumber('id')->middleware('permission:pos.cash_register,pos.access');
    Route::post('/', [CashRegisterController::class, 'store'])->middleware('permission:pos.cash_register');
    Route::patch('{id}', [CashRegisterController::class, 'update'])->whereNumber('id')->middleware('permission:pos.cash_register');
    Route::delete('{id}', [CashRegisterController::class, 'destroy'])->whereNumber('id')->middleware('permission:pos.cash_register');
    Route::post('{id}/open-session', [CashRegisterController::class, 'openSession'])
        ->whereNumber('id')->middleware('permission:pos.open_close_session,pos.access');
});

// ==================== PUNTO DE VENTA (POS) ====================
Route::prefix('pos')->middleware('auth:sanctum')->group(function () {
    Route::post('scan', [POSController::class, 'scan'])->middleware('permission:pos.access,pos.create_sale');
    Route::post('search', [POSController::class, 'search'])->middleware('permission:pos.access,pos.create_sale');
    Route::get('products', [POSController::class, 'products'])->middleware('permission:pos.access,pos.create_sale');
    Route::get('product/{productId}/variants', [POSController::class, 'productVariants'])->whereNumber('productId')->middleware('permission:pos.access,pos.create_sale');
    Route::post('calculate', [POSController::class, 'calculate'])->middleware('permission:pos.access,pos.create_sale');
    Route::post('sale', [POSController::class, 'createSale'])->middleware('permission:pos.access,pos.create_sale');
    // Anular, devolver y editar ventas exigen pos.cancel_sale (antes bastaba pos.access).
    Route::post('sale/{id}/cancel', [POSController::class, 'cancelSale'])->whereNumber('id')->middleware('permission:pos.cancel_sale');
    Route::post('sale/{id}/return', [POSController::class, 'returnSale'])->whereNumber('id')->middleware('permission:pos.cancel_sale');
    Route::put('sale/{id}', [POSController::class, 'updateSale'])->whereNumber('id')->middleware('permission:pos.cancel_sale');
    Route::get('sales', [POSController::class, 'salesHistory'])->middleware('permission:pos.access,pos.view_sales');
    Route::get('stats', [POSController::class, 'stats'])->middleware('permission:pos.access,pos.view_sales');
    Route::get('debts', [POSController::class, 'debts'])->middleware('permission:pos.access,pos.view_sales');
    Route::post('sale/{id}/collect', [POSController::class, 'collectDebt'])->whereNumber('id')->middleware('permission:pos.access,pos.create_sale');
    Route::get('customer/search', [POSController::class, 'customerSearch'])->middleware('permission:pos.access,pos.create_sale');
    Route::get('customers', [POSController::class, 'customers'])->middleware('permission:pos.access,pos.view_sales');
    Route::get('customers/{id}', [POSController::class, 'customerDetail'])->whereNumber('id')->middleware('permission:pos.access,pos.view_sales');
    Route::get('sale/{id}', [POSController::class, 'saleDetail'])->whereNumber('id')->middleware('permission:pos.access,pos.view_sales');
    Route::post('sale/{id}/send-invoice', [POSController::class, 'sendInvoice'])->whereNumber('id')->middleware('permission:pos.access,pos.view_sales');
    Route::get('sale/{id}/invoice-pdf', [POSController::class, 'invoicePdf'])->whereNumber('id')->middleware('permission:pos.access,pos.view_sales');
    Route::post('sale/{id}/payment-evidence', [POSController::class, 'uploadPaymentEvidence'])->whereNumber('id')->middleware('permission:pos.access,pos.create_sale');
    Route::get('sale/{id}/payment-evidence', [POSController::class, 'getPaymentEvidence'])->whereNumber('id')->middleware('permission:pos.access,pos.view_sales');
});
