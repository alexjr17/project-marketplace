<?php

/*
| Usuarios, roles y permisos.
| Incluido desde routes/api.php (prefijo /api); el orden de las rutas de cada prefijo se conserva.
*/

use App\Http\Controllers\RoleController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

// ==================== USUARIOS ====================
Route::prefix('users')->middleware('auth:sanctum')->group(function () {
    // Perfil del usuario autenticado.
    Route::get('profile/me', [UserController::class, 'profile']);
    Route::put('profile/me', [UserController::class, 'updateProfile']);

    // Direcciones del usuario autenticado.
    Route::get('addresses', [UserController::class, 'addresses']);
    Route::post('addresses', [UserController::class, 'storeAddress']);
    Route::put('addresses/{addressId}', [UserController::class, 'updateAddress'])->whereNumber('addressId');
    Route::delete('addresses/{addressId}', [UserController::class, 'destroyAddress'])->whereNumber('addressId');
    Route::patch('addresses/{addressId}/default', [UserController::class, 'setDefaultAddress'])->whereNumber('addressId');

    // Administración de usuarios. Con users.view solo se gestionan CLIENTES; las cuentas de
    // staff y los roles los gestiona el SuperAdmin (UserPolicy).
    Route::middleware('permission:users.view')->group(function () {
        Route::get('/', [UserController::class, 'index']);
        Route::post('/', [UserController::class, 'store']);
        Route::get('{id}', [UserController::class, 'show'])->whereNumber('id');
        Route::put('{id}', [UserController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [UserController::class, 'destroy'])->whereNumber('id');
    });
});

// ==================== ROLES Y PERMISOS ====================
Route::prefix('roles')->middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::get('permissions', [RoleController::class, 'permissions']);
    Route::get('stats', [RoleController::class, 'stats']);
    Route::post('assign', [RoleController::class, 'assign']);
    Route::get('/', [RoleController::class, 'index']);
    Route::post('/', [RoleController::class, 'store']);
    Route::get('{id}', [RoleController::class, 'show'])->whereNumber('id');
    Route::get('{id}/users', [RoleController::class, 'usersByRole'])->whereNumber('id');
    Route::put('{id}', [RoleController::class, 'update'])->whereNumber('id');
    Route::delete('{id}', [RoleController::class, 'destroy'])->whereNumber('id');
});
