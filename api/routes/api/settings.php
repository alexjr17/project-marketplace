<?php

/*
| Configuración, subida de imágenes y plantillas de etiquetas.
| Incluido desde routes/api.php (prefijo /api); el orden de las rutas de cada prefijo se conserva.
*/

use App\Http\Controllers\LabelTemplateController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\UploadController;
use Illuminate\Support\Facades\Route;

// ==================== CONFIGURACIÓN ====================
Route::prefix('settings')->group(function () {
    Route::get('public', [SettingController::class, 'getPublic']);

    // Por tipo: el permiso depende del tipo (SettingController::TYPE_PERMISSIONS).
    Route::middleware('auth:sanctum')->group(function () {
        $types = 'store|orders|payments|notifications|general|appearance|shipping|home|catalog|legal|printing';
        Route::get('{type}/config', [SettingController::class, 'getConfig'])->where('type', $types);
        Route::put('{type}/config', [SettingController::class, 'updateConfig'])->where('type', $types);
    });

    // Genérico por clave: solo SuperAdmin.
    Route::middleware(['auth:sanctum', 'admin'])->group(function () {
        Route::get('/', [SettingController::class, 'index']);
        Route::get('{key}', [SettingController::class, 'showByKey']);
        Route::put('{key}', [SettingController::class, 'updateByKey']);
    });
});

// ==================== SUBIDA DE IMÁGENES ====================
Route::prefix('uploads')->group(function () {
    Route::get('optimize', [UploadController::class, 'getOptimizedUrl']);
    Route::middleware(['auth:sanctum', 'throttle:uploads'])->group(function () {
        Route::post('image', [UploadController::class, 'uploadImage']);
        Route::post('images', [UploadController::class, 'uploadMultipleImages']);
        // Solo admin: descarga URLs externas (con protección SSRF). La tienda no la usa.
        Route::post('from-url', [UploadController::class, 'uploadFromUrl'])->middleware('admin');
        Route::post('base64', [UploadController::class, 'uploadBase64']);
        Route::delete('{publicId}', [UploadController::class, 'deleteImage'])
            ->where('publicId', '.*')->middleware('admin');
    });
});

// ==================== PLANTILLAS DE ETIQUETAS ====================
Route::prefix('label-templates')->middleware('auth:sanctum')->group(function () {
    // Leer plantillas: también quien imprime códigos de barras (products.view).
    Route::get('/', [LabelTemplateController::class, 'index'])->middleware('permission:settings.label_templates,settings.general,products.view');
    Route::get('product-type/{productTypeId}', [LabelTemplateController::class, 'forProductType'])
        ->whereNumber('productTypeId')->middleware('permission:settings.label_templates,settings.general,products.view');
    Route::get('{id}', [LabelTemplateController::class, 'show'])->whereNumber('id')->middleware('permission:settings.label_templates,settings.general,products.view');
    Route::post('/', [LabelTemplateController::class, 'store'])->middleware('permission:settings.label_templates,settings.general');
    Route::patch('{id}', [LabelTemplateController::class, 'update'])->whereNumber('id')->middleware('permission:settings.label_templates,settings.general');
    Route::delete('{id}', [LabelTemplateController::class, 'destroy'])->whereNumber('id')->middleware('permission:settings.label_templates,settings.general');
    Route::post('{id}/duplicate', [LabelTemplateController::class, 'duplicate'])->whereNumber('id')->middleware('permission:settings.label_templates,settings.general');

    // Editar plantillas: el permiso de etiquetas (settings.general se conserva por compatibilidad).
    Route::middleware('permission:settings.label_templates,settings.general')->group(function () {
        Route::post('{templateId}/zones', [LabelTemplateController::class, 'createZone'])->whereNumber('templateId');
        Route::patch('{templateId}/zones/batch', [LabelTemplateController::class, 'updateZonesBatch'])->whereNumber('templateId');
        Route::patch('zones/{zoneId}', [LabelTemplateController::class, 'updateZone'])->whereNumber('zoneId');
        Route::delete('zones/{zoneId}', [LabelTemplateController::class, 'deleteZone'])->whereNumber('zoneId');
    });
});
