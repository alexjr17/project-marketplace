<?php

/*
| Catálogos de atributos (tallas, colores, categorías, tipos) e imágenes servidas.
| Incluido desde routes/api.php (prefijo /api); el orden de las rutas de cada prefijo se conserva.
*/

use App\Http\Controllers\CatalogController;
use App\Http\Controllers\ImageController;
use Illuminate\Support\Facades\Route;

// ==================== CATÁLOGOS (tallas, colores, categorías, tipos) ====================
Route::prefix('catalogs')->group(function () {
    // Lectura pública.
    Route::get('sizes', [CatalogController::class, 'listSizes']);
    Route::get('sizes/{id}', [CatalogController::class, 'getSize'])->whereNumber('id');
    Route::get('colors', [CatalogController::class, 'listColors']);
    Route::get('colors/{id}', [CatalogController::class, 'getColor'])->whereNumber('id');
    Route::get('categories', [CatalogController::class, 'listCategories']);
    // Tarjetas de la portada: nº de productos activos e imagen por categoría.
    Route::get('categories/stats', [CatalogController::class, 'categoriesWithStats'])->middleware('throttle:storefront');
    Route::get('categories/{id}', [CatalogController::class, 'getCategory'])->whereNumber('id');
    Route::get('product-types', [CatalogController::class, 'listProductTypes']);
    Route::get('product-types/{id}', [CatalogController::class, 'getProductType'])->whereNumber('id');
    Route::get('product-types/{productTypeId}/sizes', [CatalogController::class, 'sizesByProductType'])->whereNumber('productTypeId');

    // Escritura de atributos: cada uno con su permiso (antes solo SuperAdmin).
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('sizes', [CatalogController::class, 'createSize'])->middleware('permission:sizes.view');
        Route::put('sizes/{id}', [CatalogController::class, 'updateSize'])->whereNumber('id')->middleware('permission:sizes.view');
        Route::delete('sizes/{id}', [CatalogController::class, 'deleteSize'])->whereNumber('id')->middleware('permission:sizes.view');

        Route::post('colors', [CatalogController::class, 'createColor'])->middleware('permission:colors.view');
        Route::put('colors/{id}', [CatalogController::class, 'updateColor'])->whereNumber('id')->middleware('permission:colors.view');
        Route::delete('colors/{id}', [CatalogController::class, 'deleteColor'])->whereNumber('id')->middleware('permission:colors.view');

        Route::post('categories', [CatalogController::class, 'createCategory'])->middleware('permission:categories.view');
        Route::put('categories/{id}', [CatalogController::class, 'updateCategory'])->whereNumber('id')->middleware('permission:categories.view');
        Route::delete('categories/{id}', [CatalogController::class, 'deleteCategory'])->whereNumber('id')->middleware('permission:categories.view');

        Route::post('product-types', [CatalogController::class, 'createProductType'])->middleware('permission:product_types.view');
        Route::put('product-types/{id}', [CatalogController::class, 'updateProductType'])->whereNumber('id')->middleware('permission:product_types.view');
        Route::delete('product-types/{id}', [CatalogController::class, 'deleteProductType'])->whereNumber('id')->middleware('permission:product_types.view');
        Route::put('product-types/{productTypeId}/sizes', [CatalogController::class, 'assignSizesToProductType'])->whereNumber('productTypeId')->middleware('permission:product_types.view');
    });
});

// ==================== IMÁGENES (servidas con cache) ====================
Route::get('img/{type}/{id}/{slot}', [ImageController::class, 'show'])
    ->where('id', '[0-9]+')->middleware('throttle:images');
