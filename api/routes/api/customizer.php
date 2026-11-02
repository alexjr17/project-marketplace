<?php

/*
| Personalizador: plantillas, zonas, recetas, tipos de zona e imágenes de diseño.
| Incluido desde routes/api.php (prefijo /api); el orden de las rutas de cada prefijo se conserva.
*/

use App\Http\Controllers\DesignImageController;
use App\Http\Controllers\TemplateController;
use App\Http\Controllers\TemplateRecipeController;
use App\Http\Controllers\TemplateZoneController;
use App\Http\Controllers\ZoneTypeController;
use Illuminate\Support\Facades\Route;

// ==================== PLANTILLAS (personalizador) ====================
Route::prefix('templates')->group(function () {
    Route::get('public', [TemplateController::class, 'publicList']);
    Route::get('type/{typeSlug}', [TemplateController::class, 'byType']);
    Route::get('{id}', [TemplateController::class, 'show'])->whereNumber('id');
    Route::middleware(['auth:sanctum', 'permission:templates.view'])->group(function () {
        Route::get('/', [TemplateController::class, 'index']);
        Route::post('/', [TemplateController::class, 'store']);
        Route::put('{id}', [TemplateController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [TemplateController::class, 'destroy'])->whereNumber('id');
    });
});

// ==================== ZONAS DE PLANTILLA ====================
Route::prefix('template-zones')->group(function () {
    Route::get('template/{templateId}', [TemplateZoneController::class, 'byTemplate'])->whereNumber('templateId');
    Route::get('{id}', [TemplateZoneController::class, 'show'])->whereNumber('id');
    Route::middleware(['auth:sanctum', 'permission:templates.view'])->group(function () {
        Route::post('template/{templateId}', [TemplateZoneController::class, 'store'])->whereNumber('templateId');
        Route::put('{id}', [TemplateZoneController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [TemplateZoneController::class, 'destroy'])->whereNumber('id');
        Route::post('{zoneId}/input', [TemplateZoneController::class, 'upsertInput'])->whereNumber('zoneId');
        Route::delete('{zoneId}/input', [TemplateZoneController::class, 'deleteInput'])->whereNumber('zoneId');
    });
});

// ==================== RECETAS DE PLANTILLA ====================
Route::prefix('template-recipes')->group(function () {
    Route::get('product/{productId}/stock', [TemplateRecipeController::class, 'availableStock'])->whereNumber('productId');
    Route::get('variant-stock/{productId}', [TemplateRecipeController::class, 'variantStock'])->whereNumber('productId');
    // Gestión de recetas: solo quien administra plantillas (antes bastaba con estar autenticado
    // y cualquier cliente podía crear o borrar recetas y romper el stock de las plantillas).
    Route::middleware(['auth:sanctum', 'permission:templates.view'])->group(function () {
        Route::post('/', [TemplateRecipeController::class, 'store']);
        Route::get('variant/{variantId}', [TemplateRecipeController::class, 'byVariant'])->whereNumber('variantId');
        Route::get('product/{productId}/inputs', [TemplateRecipeController::class, 'associatedInputIds'])->whereNumber('productId');
        Route::get('product/{productId}', [TemplateRecipeController::class, 'byProduct'])->whereNumber('productId');
        Route::post('product/{productId}/associate', [TemplateRecipeController::class, 'associateInputs'])->whereNumber('productId');
        Route::delete('variant/{variantId}/input/{inputVariantId}', [TemplateRecipeController::class, 'destroySpecific'])->whereNumber('variantId')->whereNumber('inputVariantId');
        Route::delete('variant/{variantId}', [TemplateRecipeController::class, 'destroyByVariant'])->whereNumber('variantId');
    });
});

// ==================== TIPOS DE ZONA ====================
Route::prefix('zone-types')->group(function () {
    Route::get('/', [ZoneTypeController::class, 'index']);
    Route::get('{id}', [ZoneTypeController::class, 'show'])->whereNumber('id');
    Route::middleware(['auth:sanctum', 'permission:zone_types.view'])->group(function () {
        Route::post('/', [ZoneTypeController::class, 'store']);
        Route::put('{id}', [ZoneTypeController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [ZoneTypeController::class, 'destroy'])->whereNumber('id');
    });
});

// ==================== IMÁGENES DE DISEÑO ====================
Route::prefix('design-images')->group(function () {
    Route::get('/', [DesignImageController::class, 'index']);
    Route::get('categories', [DesignImageController::class, 'categories']);
    Route::get('{id}', [DesignImageController::class, 'show'])->whereNumber('id');
    Route::middleware(['auth:sanctum', 'permission:design_images.view'])->group(function () {
        Route::post('/', [DesignImageController::class, 'store']);
        Route::put('sort-order', [DesignImageController::class, 'updateSortOrder']);
        Route::put('{id}', [DesignImageController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [DesignImageController::class, 'destroy'])->whereNumber('id');
    });
});
