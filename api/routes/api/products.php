<?php

/*
| Productos, variantes, reseñas y códigos de barras.
| Incluido desde routes/api.php (prefijo /api); el orden de las rutas de cada prefijo se conserva.
*/

use App\Http\Controllers\BarcodeController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\VariantController;
use Illuminate\Support\Facades\Route;

// ==================== PRODUCTOS ====================
Route::prefix('products')->group(function () {
    // Lectura pública.
    Route::get('featured', [ProductController::class, 'featured']);
    Route::get('categories', [ProductController::class, 'categories']);
    Route::get('types', [ProductController::class, 'types']);
    Route::get('category/{category}', [ProductController::class, 'byCategory']);
    Route::get('/', [ProductController::class, 'index']);
    Route::get('{id}', [ProductController::class, 'show'])->whereNumber('id');

    // Crear, editar y borrar productos: products.manage (ver la lista es products.view).
    Route::middleware(['auth:sanctum', 'permission:products.manage'])->group(function () {
        Route::post('/', [ProductController::class, 'store']);
        Route::put('{id}', [ProductController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [ProductController::class, 'destroy'])->whereNumber('id');
        Route::patch('{id}/stock', [ProductController::class, 'updateStock'])->whereNumber('id');
    });
});

// ==================== VARIANTES DE PRODUCTO ====================
Route::prefix('variants')->middleware('auth:sanctum')->group(function () {
    Route::get('barcode/{barcode}', [VariantController::class, 'byBarcode'])
        ->middleware('permission:variants.view,pos.access,products.view');
    Route::get('sku/{sku}', [VariantController::class, 'bySku'])
        ->middleware('permission:variants.view,pos.access,products.view');
    Route::get('lookup', [VariantController::class, 'lookup']);
    Route::get('low-stock', [VariantController::class, 'lowStock'])
        ->middleware('permission:variants.view,products.view');
    Route::get('products', [VariantController::class, 'productVariants'])
        ->middleware('permission:variants.view,products.view');
    Route::get('templates', [VariantController::class, 'templateVariants'])
        ->middleware('permission:variants.view,products.view');
    Route::post('generate/{productId}', [VariantController::class, 'generate'])
        ->whereNumber('productId')->middleware('permission:variants.view');

    Route::get('/', [VariantController::class, 'index'])->middleware('permission:variants.view,products.view');
    Route::post('/', [VariantController::class, 'store'])->middleware('permission:variants.view');
    Route::get('{id}', [VariantController::class, 'show'])->whereNumber('id')
        ->middleware('permission:variants.view,products.view');
    Route::patch('{id}', [VariantController::class, 'update'])->whereNumber('id')
        ->middleware('permission:variants.view');
    Route::delete('{id}', [VariantController::class, 'destroy'])->whereNumber('id')
        ->middleware('permission:variants.view');
    Route::post('{id}/adjust-stock', [VariantController::class, 'adjustStock'])->whereNumber('id')
        ->middleware('permission:variants.view');
});

// ==================== RESEÑAS ====================
Route::prefix('reviews')->group(function () {
    // Públicas.
    Route::get('product/{productId}', [ReviewController::class, 'productReviews'])
        ->whereNumber('productId')->middleware('auth.optional');
    Route::get('product/{productId}/summary', [ReviewController::class, 'productSummary'])
        ->whereNumber('productId');

    // Usuario autenticado.
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('can-review/{productId}', [ReviewController::class, 'canReview'])->whereNumber('productId');
        Route::get('pending/products', [ReviewController::class, 'awaitingReview']);
        Route::get('my/all', [ReviewController::class, 'myReviews']);
        Route::post('/', [ReviewController::class, 'store']);
        Route::put('{id}', [ReviewController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [ReviewController::class, 'destroy'])->whereNumber('id');
        Route::post('{id}/vote', [ReviewController::class, 'vote'])->whereNumber('id');
        Route::delete('{id}/vote', [ReviewController::class, 'removeVote'])->whereNumber('id');
    });

    // Admin.
    Route::middleware(['auth:sanctum', 'permission:reviews.view'])->group(function () {
        Route::get('admin/all', [ReviewController::class, 'adminList']);
        Route::patch('admin/{id}/moderate', [ReviewController::class, 'moderate'])->whereNumber('id');
        Route::delete('admin/{id}', [ReviewController::class, 'adminDestroy'])->whereNumber('id');
    });

    // Detalle por ID (pública con auth opcional) — al final por el orden de rutas.
    Route::get('{id}', [ReviewController::class, 'show'])->whereNumber('id')->middleware('auth.optional');
});

// ==================== CÓDIGOS DE BARRAS ====================
Route::prefix('barcodes')->middleware('auth:sanctum')->group(function () {
    Route::get('image/{variantId}', [BarcodeController::class, 'variantImage'])
        ->whereNumber('variantId')->middleware('permission:products.view,pos.access');
    Route::post('image', [BarcodeController::class, 'generateImage'])->middleware('permission:products.view');
    Route::get('label/{variantId}', [BarcodeController::class, 'variantLabel'])
        ->whereNumber('variantId')->middleware('permission:products.view');
    Route::post('labels/batch', [BarcodeController::class, 'batchLabels'])->middleware('permission:products.view');
    Route::get('labels/product/{productId}', [BarcodeController::class, 'productLabels'])
        ->whereNumber('productId')->middleware('permission:products.view');
    Route::post('assign/{variantId}', [BarcodeController::class, 'assign'])
        ->whereNumber('variantId')->middleware('permission:products.view');
    Route::post('assign-all', [BarcodeController::class, 'assignAll'])->middleware('permission:products.view');
    Route::post('validate', [BarcodeController::class, 'validateBarcode'])->middleware('permission:products.view');
    Route::post('print', [BarcodeController::class, 'print'])->middleware('permission:products.view');
});
