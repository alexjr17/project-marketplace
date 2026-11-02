<?php

/*
| Webhooks de pasarelas de pago y de Meta.
| Incluido desde routes/api.php (prefijo /api); el orden de las rutas de cada prefijo se conserva.
*/

use App\Http\Controllers\WebhookController;
use Illuminate\Support\Facades\Route;

// ==================== WEBHOOKS ====================
Route::prefix('webhooks')->group(function () {
    Route::post('wompi', [WebhookController::class, 'wompi']);
    Route::get('wompi/verify/{transactionId}', [WebhookController::class, 'verifyWompiTransaction'])
        ->middleware(['auth:sanctum', 'permission:payments.view']);

    Route::post('mercadopago', [WebhookController::class, 'mercadopago']);
    Route::get('mercadopago/confirm/{orderNumber}', [WebhookController::class, 'confirmMercadoPago']);

    // Meta — Messenger (Instagram comparte el mismo endpoint en futuro).
    Route::get('messenger', [WebhookController::class, 'messengerVerify']);
    Route::post('messenger', [WebhookController::class, 'messengerIncoming']);

    // Meta — WhatsApp Cloud API (payload diferente, endpoint separado).
    Route::get('whatsapp', [WebhookController::class, 'whatsappVerify']);
    Route::post('whatsapp', [WebhookController::class, 'whatsappIncoming']);
});
