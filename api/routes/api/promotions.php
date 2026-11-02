<?php

/*
| Publicidad y cupones.
| Incluido desde routes/api.php (prefijo /api); el orden de las rutas de cada prefijo se conserva.
*/

use App\Http\Controllers\AnnouncementController;
use App\Http\Controllers\DiscountController;
use Illuminate\Support\Facades\Route;

// ==================== PUBLICIDAD / ANUNCIOS ====================
Route::get('announcements/active', [AnnouncementController::class, 'active']);
Route::prefix('announcements')->middleware(['auth:sanctum', 'permission:announcements.view'])->group(function () {
    Route::get('/', [AnnouncementController::class, 'index']);
    Route::post('/', [AnnouncementController::class, 'store']);
    Route::put('{id}', [AnnouncementController::class, 'update'])->whereNumber('id');
    Route::delete('{id}', [AnnouncementController::class, 'destroy'])->whereNumber('id');
});

// ==================== CUPONES / DESCUENTOS ====================
// Validar cupón: opcional autenticado (para límites por usuario) pero accesible a invitados.
Route::post('discounts/validate', [DiscountController::class, 'validateCoupon'])
    ->middleware(['auth.optional', 'throttle:coupons']);
Route::prefix('discounts')->middleware(['auth:sanctum', 'permission:discounts.view'])->group(function () {
    Route::get('/', [DiscountController::class, 'index']);
    Route::post('/', [DiscountController::class, 'store']);
    Route::put('{id}', [DiscountController::class, 'update'])->whereNumber('id');
    Route::delete('{id}', [DiscountController::class, 'destroy'])->whereNumber('id');
});
