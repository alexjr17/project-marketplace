<?php

/*
| Inventario: insumos, lotes, movimientos, conteos y conversiones.
| Incluido desde routes/api.php (prefijo /api); el orden de las rutas de cada prefijo se conserva.
*/

use App\Http\Controllers\InputBatchController;
use App\Http\Controllers\InputController;
use App\Http\Controllers\InputTypeController;
use App\Http\Controllers\InventoryConversionController;
use App\Http\Controllers\InventoryCountController;
use App\Http\Controllers\InventoryMovementController;
use Illuminate\Support\Facades\Route;

// ==================== TIPOS DE INSUMO ====================
Route::prefix('input-types')->middleware(['auth:sanctum', 'permission:input_types.view'])->group(function () {
    Route::get('/', [InputTypeController::class, 'index']);
    Route::get('{id}', [InputTypeController::class, 'show'])->whereNumber('id');
    Route::post('/', [InputTypeController::class, 'store']);
    Route::put('{id}', [InputTypeController::class, 'update'])->whereNumber('id');
    Route::delete('{id}', [InputTypeController::class, 'destroy'])->whereNumber('id');
});

// ==================== INSUMOS ====================
Route::prefix('inputs')->middleware(['auth:sanctum', 'permission:inputs.view'])->group(function () {
    Route::get('low-stock', [InputController::class, 'lowStock']);
    Route::get('all-variants', [InputController::class, 'allVariants']);
    Route::get('variants/{variantId}', [InputController::class, 'variantById'])->whereNumber('variantId');
    Route::put('variants/{variantId}', [InputController::class, 'updateVariant'])->whereNumber('variantId');
    Route::post('variants/{variantId}/stock', [InputController::class, 'updateVariantStock'])->whereNumber('variantId');
    Route::get('variants/{variantId}/movements', [InputController::class, 'variantMovements'])->whereNumber('variantId');
    Route::get('/', [InputController::class, 'index']);
    Route::post('/', [InputController::class, 'store']);
    Route::get('{id}', [InputController::class, 'show'])->whereNumber('id');
    Route::put('{id}', [InputController::class, 'update'])->whereNumber('id');
    Route::delete('{id}', [InputController::class, 'destroy'])->whereNumber('id');
    Route::post('{id}/recalculate-stock', [InputController::class, 'recalculateStock'])->whereNumber('id');
    Route::post('{id}/colors', [InputController::class, 'addColor'])->whereNumber('id');
    Route::delete('{id}/colors/{colorId}', [InputController::class, 'removeColor'])->whereNumber('id')->whereNumber('colorId');
    Route::post('{id}/sizes', [InputController::class, 'addSize'])->whereNumber('id');
    Route::delete('{id}/sizes/{sizeId}', [InputController::class, 'removeSize'])->whereNumber('id')->whereNumber('sizeId');
    Route::get('{id}/variants', [InputController::class, 'variants'])->whereNumber('id');
    Route::post('{id}/regenerate-variants', [InputController::class, 'regenerateVariants'])->whereNumber('id');
});

// ==================== LOTES DE INSUMO ====================
Route::prefix('input-batches')->middleware(['auth:sanctum', 'permission:inputs.view'])->group(function () {
    Route::get('movements/all', [InputBatchController::class, 'allMovements']);
    Route::get('movements/stats', [InputBatchController::class, 'movementsStats']);
    Route::get('input/{inputId}/movements', [InputBatchController::class, 'movementsByInput'])->whereNumber('inputId');
    Route::get('input/{inputId}', [InputBatchController::class, 'byInput'])->whereNumber('inputId');
    Route::post('input/{inputId}', [InputBatchController::class, 'store'])->whereNumber('inputId');
    Route::get('{id}/movements', [InputBatchController::class, 'movementsByBatch'])->whereNumber('id');
    Route::get('{id}', [InputBatchController::class, 'show'])->whereNumber('id');
    Route::put('{id}', [InputBatchController::class, 'update'])->whereNumber('id');
    Route::post('{id}/adjust', [InputBatchController::class, 'adjust'])->whereNumber('id');
    Route::post('{id}/reserve', [InputBatchController::class, 'reserve'])->whereNumber('id');
    Route::post('{id}/release', [InputBatchController::class, 'release'])->whereNumber('id');
    Route::post('{id}/output', [InputBatchController::class, 'output'])->whereNumber('id');
});

// ==================== INVENTARIO (movimientos de variantes) ====================
Route::prefix('inventory')->middleware('auth:sanctum')->group(function () {
    Route::get('stats', [InventoryMovementController::class, 'stats'])->middleware('permission:inventory_movements.view');
    Route::get('low-stock', [InventoryMovementController::class, 'lowStock'])->middleware('permission:inventory_movements.view');
    Route::get('summary', [InventoryMovementController::class, 'summary'])->middleware('permission:inventory_movements.view');
    Route::get('movements/variant/{variantId}', [InventoryMovementController::class, 'variantMovements'])
        ->whereNumber('variantId')->middleware('permission:inventory_movements.view');
    Route::get('movements', [InventoryMovementController::class, 'movements'])->middleware('permission:inventory_movements.view');
    Route::post('movements', [InventoryMovementController::class, 'createMovement'])->middleware('permission:inventory_movements.view');
    Route::post('bulk-adjustment', [InventoryMovementController::class, 'bulkAdjustment'])->middleware('permission:inventory_movements.view');
});

// ==================== CONTEOS DE INVENTARIO ====================
Route::prefix('inventory-counts')->middleware('auth:sanctum')->group(function () {
    Route::get('stats', [InventoryCountController::class, 'stats'])->middleware('permission:inventory_counts.view');
    Route::get('/', [InventoryCountController::class, 'index'])->middleware('permission:inventory_counts.view');
    Route::get('{id}', [InventoryCountController::class, 'show'])->whereNumber('id')->middleware('permission:inventory_counts.view');
    Route::post('/', [InventoryCountController::class, 'store'])->middleware('permission:inventory_counts.view');
    Route::patch('{id}/start', [InventoryCountController::class, 'start'])->whereNumber('id')->middleware('permission:inventory_counts.view');
    Route::patch('{id}/items/{itemId}', [InventoryCountController::class, 'updateItemCount'])
        ->whereNumber('id')->whereNumber('itemId')->middleware('permission:inventory_counts.view');
    Route::patch('{id}/submit', [InventoryCountController::class, 'submit'])->whereNumber('id')->middleware('permission:inventory_counts.view');
    Route::patch('{id}/approve', [InventoryCountController::class, 'approve'])->whereNumber('id')->middleware('permission:inventory_counts.view');
    Route::patch('{id}/cancel', [InventoryCountController::class, 'cancel'])->whereNumber('id')->middleware('permission:inventory_counts.view');
    Route::delete('{id}', [InventoryCountController::class, 'destroy'])->whereNumber('id')->middleware('permission:inventory_counts.view');
});

// ==================== CONVERSIONES DE INVENTARIO ====================
Route::prefix('inventory-conversions')->middleware('auth:sanctum')->group(function () {
    Route::get('stats', [InventoryConversionController::class, 'stats'])->middleware('permission:conversions.view');
    Route::post('from-template', [InventoryConversionController::class, 'fromTemplate'])->middleware('permission:conversions.view');
    Route::get('/', [InventoryConversionController::class, 'index'])->middleware('permission:conversions.view');
    Route::get('{id}', [InventoryConversionController::class, 'show'])->whereNumber('id')->middleware('permission:conversions.view');
    Route::post('/', [InventoryConversionController::class, 'store'])->middleware('permission:conversions.view');
    Route::delete('{id}', [InventoryConversionController::class, 'destroy'])->whereNumber('id')->middleware('permission:conversions.view');

    Route::middleware('permission:conversions.view')->group(function () {
        Route::post('{id}/input-items', [InventoryConversionController::class, 'addInputItem'])->whereNumber('id');
        Route::patch('{id}/input-items/{itemId}', [InventoryConversionController::class, 'updateInputItem'])->whereNumber('id')->whereNumber('itemId');
        Route::delete('{id}/input-items/{itemId}', [InventoryConversionController::class, 'removeInputItem'])->whereNumber('id')->whereNumber('itemId');
        Route::post('{id}/output-items', [InventoryConversionController::class, 'addOutputItem'])->whereNumber('id');
        Route::patch('{id}/output-items/{itemId}', [InventoryConversionController::class, 'updateOutputItem'])->whereNumber('id')->whereNumber('itemId');
        Route::delete('{id}/output-items/{itemId}', [InventoryConversionController::class, 'removeOutputItem'])->whereNumber('id')->whereNumber('itemId');
        Route::post('{id}/submit', [InventoryConversionController::class, 'submit'])->whereNumber('id');
        Route::post('{id}/approve', [InventoryConversionController::class, 'approve'])->whereNumber('id');
        Route::post('{id}/cancel', [InventoryConversionController::class, 'cancel'])->whereNumber('id');
    });
});
