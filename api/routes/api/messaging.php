<?php

/*
| Notificaciones y mensajería (bandeja de admin y chat web).
| Incluido desde routes/api.php (prefijo /api); el orden de las rutas de cada prefijo se conserva.
*/

use App\Http\Controllers\BotKnowledgeCategoryController;
use App\Http\Controllers\BotKnowledgeController;
use App\Http\Controllers\ChannelController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\SocialPostController;
use App\Http\Controllers\WebChatController;
use Illuminate\Support\Facades\Route;

// ==================== NOTIFICACIONES ====================
Route::prefix('notifications')->middleware('auth:sanctum')->group(function () {
    Route::get('unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('mark-all-read', [NotificationController::class, 'markAllAsRead']);
    Route::post('mark-read', [NotificationController::class, 'markMultipleAsRead']);
    Route::get('/', [NotificationController::class, 'index']);
    Route::get('{id}', [NotificationController::class, 'show'])->whereNumber('id');
    Route::patch('{id}/read', [NotificationController::class, 'markAsRead'])->whereNumber('id');
    Route::delete('{id}', [NotificationController::class, 'destroy'])->whereNumber('id');
});

// ==================== MENSAJERÍA — bandeja y canales de admin ====================
Route::prefix('messaging')->middleware(['auth:sanctum', 'permission:messaging.access'])->group(function () {
    // Conversaciones (Bandeja)
    Route::middleware('permission:messaging.inbox')->group(function () {
        Route::get('conversations', [ConversationController::class, 'index']);
        Route::get('conversations/{id}', [ConversationController::class, 'show'])->whereNumber('id');
        Route::patch('conversations/{id}', [ConversationController::class, 'update'])->whereNumber('id');
        Route::post('conversations/{id}/read', [ConversationController::class, 'markRead'])->whereNumber('id');
        Route::get('conversations/{id}/messages', [ConversationController::class, 'messages'])->whereNumber('id');
        Route::post('conversations/{id}/messages', [MessageController::class, 'store'])->whereNumber('id');
        Route::post('conversations/{id}/suggest', [MessageController::class, 'suggest'])->whereNumber('id');
    });

    // Canales (Meta Messenger, Instagram, WhatsApp, SMS, Chat Web).
    // La pestaña "Páginas" también lee los canales conectados.
    Route::middleware('permission:messaging.channels,messaging.pages')->group(function () {
        Route::get('channels', [ChannelController::class, 'index']);
        Route::get('channels/{id}', [ChannelController::class, 'show'])->whereNumber('id');
    });
    Route::middleware('permission:messaging.channels')->group(function () {
        Route::patch('channels/{id}', [ChannelController::class, 'update'])->whereNumber('id');
        Route::post('channels/{id}/test', [ChannelController::class, 'test'])->whereNumber('id');
    });

    // Base de conocimiento del bot (Entrenar IA)
    Route::middleware('permission:messaging.knowledge')->group(function () {
        Route::get('knowledge/categories', [BotKnowledgeCategoryController::class, 'index']);
        Route::post('knowledge/categories', [BotKnowledgeCategoryController::class, 'store']);
        Route::patch('knowledge/categories/{id}', [BotKnowledgeCategoryController::class, 'update'])->whereNumber('id');
        Route::delete('knowledge/categories/{id}', [BotKnowledgeCategoryController::class, 'destroy'])->whereNumber('id');

        Route::get('knowledge', [BotKnowledgeController::class, 'index']);
        Route::post('knowledge', [BotKnowledgeController::class, 'store']);
        Route::patch('knowledge/{id}', [BotKnowledgeController::class, 'update'])->whereNumber('id');
        Route::delete('knowledge/{id}', [BotKnowledgeController::class, 'destroy'])->whereNumber('id');
        Route::post('knowledge/test', [BotKnowledgeController::class, 'test']);
    });

    // Publicaciones (Facebook Page; Instagram + programación en fases siguientes)
    Route::middleware('permission:messaging.posts')->group(function () {
        Route::get('posts', [SocialPostController::class, 'index']);
        Route::post('posts', [SocialPostController::class, 'store']);
        Route::post('posts/publish', [SocialPostController::class, 'publishNow']);
        Route::get('posts/{id}', [SocialPostController::class, 'show'])->whereNumber('id');
        Route::post('posts/{id}/publish', [SocialPostController::class, 'publishExisting'])->whereNumber('id');
        Route::delete('posts/{id}', [SocialPostController::class, 'destroy'])->whereNumber('id');
    });
});

// ==================== MENSAJERÍA — chat web público ====================
// El widget de la tienda usa estas rutas. No requieren login; se autentican
// con un token de sesión devuelto por /start y enviado en X-WebChat-Token.
Route::prefix('webchat')->middleware('throttle:webchat')->group(function () {
    Route::post('start', [WebChatController::class, 'start']);
    Route::post('send', [WebChatController::class, 'send']);
    Route::get('poll', [WebChatController::class, 'poll']);
});
