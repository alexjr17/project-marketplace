<?php

/*
| Fábrica (manufacturing).
| Incluido desde routes/api.php (prefijo /api); el orden de las rutas de cada prefijo se conserva.
*/

use App\Http\Controllers\MfgBrandController;
use App\Http\Controllers\MfgClientController;
use App\Http\Controllers\MfgCollectionController;
use App\Http\Controllers\MfgColorController;
use App\Http\Controllers\MfgDispatchController;
use App\Http\Controllers\MfgExchangeRateController;
use App\Http\Controllers\MfgGarmentTypeController;
use App\Http\Controllers\MfgInputController;
use App\Http\Controllers\MfgInputTypeController;
use App\Http\Controllers\MfgInventoryController;
use App\Http\Controllers\MfgProcessController;
use App\Http\Controllers\MfgProductionOrderController;
use App\Http\Controllers\MfgPurchaseOrderController;
use App\Http\Controllers\MfgReferenceController;
use App\Http\Controllers\MfgSizeController;
use App\Http\Controllers\MfgWarehouseController;
use App\Http\Controllers\MfgWorkshopController;
use Illuminate\Support\Facades\Route;

// ==================== FÁBRICA (manufacturing) ====================
// App de producción ligera: catálogos (procesos, talleres, bodegas) y
// referencias con su ficha técnica (colores, tallas y materiales/BOM).
Route::prefix('manufacturing')->middleware('auth:sanctum')->group(function () {
    // Catálogos propios de Fábrica (tipos de prenda, colores, tallas, insumos).
    Route::prefix('garment-types')->middleware('permission:manufacturing.catalogs.view')->group(function () {
        Route::get('/', [MfgGarmentTypeController::class, 'index']);
        Route::post('/', [MfgGarmentTypeController::class, 'store']);
        Route::put('{id}', [MfgGarmentTypeController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [MfgGarmentTypeController::class, 'destroy'])->whereNumber('id');
    });
    Route::prefix('colors')->middleware('permission:manufacturing.catalogs.view')->group(function () {
        Route::get('/', [MfgColorController::class, 'index']);
        Route::post('/', [MfgColorController::class, 'store']);
        Route::put('{id}', [MfgColorController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [MfgColorController::class, 'destroy'])->whereNumber('id');
    });
    Route::prefix('sizes')->middleware('permission:manufacturing.catalogs.view')->group(function () {
        Route::get('/', [MfgSizeController::class, 'index']);
        Route::post('/', [MfgSizeController::class, 'store']);
        Route::put('{id}', [MfgSizeController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [MfgSizeController::class, 'destroy'])->whereNumber('id');
    });
    Route::prefix('input-types')->middleware('permission:manufacturing.catalogs.view')->group(function () {
        Route::get('/', [MfgInputTypeController::class, 'index']);
        Route::post('/', [MfgInputTypeController::class, 'store']);
        Route::put('{id}', [MfgInputTypeController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [MfgInputTypeController::class, 'destroy'])->whereNumber('id');
    });
    Route::prefix('inputs')->middleware('permission:manufacturing.catalogs.view')->group(function () {
        Route::get('/', [MfgInputController::class, 'index']);
        Route::post('/', [MfgInputController::class, 'store']);
        Route::put('{id}', [MfgInputController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [MfgInputController::class, 'destroy'])->whereNumber('id');
        // Lotes / compras del insumo (precios para la ficha técnica).
        Route::get('{id}/batches', [MfgInputController::class, 'batches'])->whereNumber('id');
        Route::post('{id}/batches', [MfgInputController::class, 'storeBatch'])->whereNumber('id');
        Route::delete('{id}/batches/{batchId}', [MfgInputController::class, 'deleteBatch'])->whereNumber('id')->whereNumber('batchId');
    });
    Route::prefix('exchange-rates')->middleware('permission:manufacturing.catalogs.view')->group(function () {
        Route::get('/', [MfgExchangeRateController::class, 'index']);
        Route::get('active', [MfgExchangeRateController::class, 'active']);
        Route::post('/', [MfgExchangeRateController::class, 'store']);
        Route::delete('{id}', [MfgExchangeRateController::class, 'destroy'])->whereNumber('id');
    });
    Route::prefix('brands')->middleware('permission:manufacturing.catalogs.view')->group(function () {
        Route::get('/', [MfgBrandController::class, 'index']);
        Route::post('/', [MfgBrandController::class, 'store']);
        Route::put('{id}', [MfgBrandController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [MfgBrandController::class, 'destroy'])->whereNumber('id');
    });
    Route::prefix('collections')->middleware('permission:manufacturing.catalogs.view')->group(function () {
        Route::get('/', [MfgCollectionController::class, 'index']);
        Route::post('/', [MfgCollectionController::class, 'store']);
        Route::put('{id}', [MfgCollectionController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [MfgCollectionController::class, 'destroy'])->whereNumber('id');
    });
    // Configuración de planta.
    Route::prefix('processes')->middleware('permission:manufacturing.catalogs.view')->group(function () {
        Route::get('/', [MfgProcessController::class, 'index']);
        Route::post('/', [MfgProcessController::class, 'store']);
        Route::put('{id}', [MfgProcessController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [MfgProcessController::class, 'destroy'])->whereNumber('id');
    });
    Route::prefix('workshops')->middleware('permission:manufacturing.catalogs.view')->group(function () {
        Route::get('/', [MfgWorkshopController::class, 'index']);
        Route::post('/', [MfgWorkshopController::class, 'store']);
        Route::put('{id}', [MfgWorkshopController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [MfgWorkshopController::class, 'destroy'])->whereNumber('id');
    });
    Route::prefix('warehouses')->middleware('permission:manufacturing.catalogs.view')->group(function () {
        Route::get('/', [MfgWarehouseController::class, 'index']);
        Route::post('/', [MfgWarehouseController::class, 'store']);
        Route::put('{id}', [MfgWarehouseController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [MfgWarehouseController::class, 'destroy'])->whereNumber('id');
    });
    // Referencias + ficha técnica.
    Route::prefix('references')->middleware('permission:manufacturing.references.view')->group(function () {
        Route::post('generate-code', [MfgReferenceController::class, 'generateCode']);
        Route::get('/', [MfgReferenceController::class, 'index']);
        Route::get('{id}', [MfgReferenceController::class, 'show'])->whereNumber('id');
        Route::post('/', [MfgReferenceController::class, 'store']);
        Route::put('{id}', [MfgReferenceController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [MfgReferenceController::class, 'destroy'])->whereNumber('id');
    });
    // Clientes de Fábrica (catálogo propio).
    Route::prefix('clients')->middleware('permission:manufacturing.catalogs.view')->group(function () {
        Route::get('/', [MfgClientController::class, 'index']);
        Route::post('/', [MfgClientController::class, 'store']);
        Route::put('{id}', [MfgClientController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [MfgClientController::class, 'destroy'])->whereNumber('id');
    });
    // Órdenes de pedido → generan producción.
    Route::prefix('purchase-orders')->middleware('permission:manufacturing.orders.view')->group(function () {
        Route::get('generate-number', [MfgPurchaseOrderController::class, 'generateNumber']);
        Route::get('/', [MfgPurchaseOrderController::class, 'index']);
        Route::get('{id}', [MfgPurchaseOrderController::class, 'show'])->whereNumber('id');
        Route::post('/', [MfgPurchaseOrderController::class, 'store']);
        Route::put('{id}', [MfgPurchaseOrderController::class, 'update'])->whereNumber('id');
        Route::patch('{id}/status', [MfgPurchaseOrderController::class, 'changeStatus'])->whereNumber('id');
        Route::post('{id}/generate-production', [MfgPurchaseOrderController::class, 'generateProduction'])->whereNumber('id');
        Route::delete('{id}', [MfgPurchaseOrderController::class, 'destroy'])->whereNumber('id');
    });
    // Despachos / entregas de producto terminado (cierra el ciclo).
    Route::prefix('dispatches')->middleware('permission:manufacturing.orders.view')->group(function () {
        Route::get('generate-number', [MfgDispatchController::class, 'generateNumber']);
        Route::get('available', [MfgDispatchController::class, 'available']);
        Route::get('po/{poId}/pending', [MfgDispatchController::class, 'purchaseOrderPending'])->whereNumber('poId');
        Route::get('/', [MfgDispatchController::class, 'index']);
        Route::get('{id}', [MfgDispatchController::class, 'show'])->whereNumber('id');
        Route::post('/', [MfgDispatchController::class, 'store']);
        Route::put('{id}', [MfgDispatchController::class, 'update'])->whereNumber('id');
        Route::post('{id}/confirm', [MfgDispatchController::class, 'confirm'])->whereNumber('id');
        Route::post('{id}/cancel', [MfgDispatchController::class, 'cancel'])->whereNumber('id');
        Route::patch('{id}/billing', [MfgDispatchController::class, 'billing'])->whereNumber('id');
        Route::delete('{id}', [MfgDispatchController::class, 'destroy'])->whereNumber('id');
    });
    // Inventario de producto terminado por bodega.
    Route::get('inventory', [MfgInventoryController::class, 'index'])->middleware('permission:manufacturing.orders.view');
    // Órdenes de producción + etapas (Fase 2).
    Route::prefix('production-orders')->middleware('permission:manufacturing.orders.view')->group(function () {
        Route::get('generate-number', [MfgProductionOrderController::class, 'generateNumber']);
        Route::get('/', [MfgProductionOrderController::class, 'index']);
        Route::get('{id}', [MfgProductionOrderController::class, 'show'])->whereNumber('id');
        Route::post('/', [MfgProductionOrderController::class, 'store']);
        Route::put('{id}', [MfgProductionOrderController::class, 'update'])->whereNumber('id');
        Route::patch('{id}/status', [MfgProductionOrderController::class, 'changeStatus'])->whereNumber('id');
        Route::patch('{id}/stages/{stageId}', [MfgProductionOrderController::class, 'updateStage'])->whereNumber('id')->whereNumber('stageId');
        Route::get('{id}/stages/{stageId}/pdf', [MfgProductionOrderController::class, 'stagePdf'])->whereNumber('id')->whereNumber('stageId');
        Route::get('{id}/materials', [MfgProductionOrderController::class, 'materials'])->whereNumber('id');
        Route::post('{id}/substitutions', [MfgProductionOrderController::class, 'saveSubstitution'])->whereNumber('id');
        Route::delete('{id}/substitutions/{subId}', [MfgProductionOrderController::class, 'deleteSubstitution'])->whereNumber('id')->whereNumber('subId');
        Route::delete('{id}', [MfgProductionOrderController::class, 'destroy'])->whereNumber('id');
    });
});
