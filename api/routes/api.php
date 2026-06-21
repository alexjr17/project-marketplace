<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BarcodeController;
use App\Http\Controllers\BotKnowledgeCategoryController;
use App\Http\Controllers\BotKnowledgeController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\CashRegisterController;
use App\Http\Controllers\CatalogController;
use App\Http\Controllers\ChannelController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\DesignImageController;
use App\Http\Controllers\InputBatchController;
use App\Http\Controllers\InputController;
use App\Http\Controllers\InputTypeController;
use App\Http\Controllers\InventoryConversionController;
use App\Http\Controllers\InventoryCountController;
use App\Http\Controllers\InventoryMovementController;
use App\Http\Controllers\LabelTemplateController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\POSController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\PurchaseReturnController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\SocialPostController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\TemplateController;
use App\Http\Controllers\TemplateRecipeController;
use App\Http\Controllers\TemplateZoneController;
use App\Http\Controllers\UploadController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\VariantController;
use App\Http\Controllers\WebChatController;
use App\Http\Controllers\WebhookController;
use App\Http\Controllers\ZoneTypeController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rutas de la API
|--------------------------------------------------------------------------
| Todas las rutas de este archivo tienen el prefijo /api.
| Las rutas de cada módulo se van agregando por fases.
*/

// Verificación de estado del servidor.
Route::get('/health', function () {
    return response()->json([
        'success' => true,
        'message' => 'API funcionando correctamente',
        'timestamp' => now()->toIso8601String(),
        'environment' => app()->environment(),
    ]);
});

// ==================== AUTENTICACIÓN ====================
Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login', [AuthController::class, 'login']);
    Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('reset-password', [AuthController::class, 'resetPassword']);
    Route::post('logout', [AuthController::class, 'logout']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::put('me', [AuthController::class, 'updateMe']);
        Route::match(['post', 'put'], 'change-password', [AuthController::class, 'changePassword']);
    });
});

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

    // Administración de usuarios (solo SuperAdmin).
    Route::middleware('admin')->group(function () {
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

// ==================== CATÁLOGOS (tallas, colores, categorías, tipos) ====================
Route::prefix('catalogs')->group(function () {
    // Lectura pública.
    Route::get('sizes', [CatalogController::class, 'listSizes']);
    Route::get('sizes/{id}', [CatalogController::class, 'getSize'])->whereNumber('id');
    Route::get('colors', [CatalogController::class, 'listColors']);
    Route::get('colors/{id}', [CatalogController::class, 'getColor'])->whereNumber('id');
    Route::get('categories', [CatalogController::class, 'listCategories']);
    Route::get('categories/{id}', [CatalogController::class, 'getCategory'])->whereNumber('id');
    Route::get('product-types', [CatalogController::class, 'listProductTypes']);
    Route::get('product-types/{id}', [CatalogController::class, 'getProductType'])->whereNumber('id');
    Route::get('product-types/{productTypeId}/sizes', [CatalogController::class, 'sizesByProductType'])->whereNumber('productTypeId');

    // Escritura: solo SuperAdmin.
    Route::middleware(['auth:sanctum', 'admin'])->group(function () {
        Route::post('sizes', [CatalogController::class, 'createSize']);
        Route::put('sizes/{id}', [CatalogController::class, 'updateSize'])->whereNumber('id');
        Route::delete('sizes/{id}', [CatalogController::class, 'deleteSize'])->whereNumber('id');

        Route::post('colors', [CatalogController::class, 'createColor']);
        Route::put('colors/{id}', [CatalogController::class, 'updateColor'])->whereNumber('id');
        Route::delete('colors/{id}', [CatalogController::class, 'deleteColor'])->whereNumber('id');

        Route::post('categories', [CatalogController::class, 'createCategory']);
        Route::put('categories/{id}', [CatalogController::class, 'updateCategory'])->whereNumber('id');
        Route::delete('categories/{id}', [CatalogController::class, 'deleteCategory'])->whereNumber('id');

        Route::post('product-types', [CatalogController::class, 'createProductType']);
        Route::put('product-types/{id}', [CatalogController::class, 'updateProductType'])->whereNumber('id');
        Route::delete('product-types/{id}', [CatalogController::class, 'deleteProductType'])->whereNumber('id');
        Route::put('product-types/{productTypeId}/sizes', [CatalogController::class, 'assignSizesToProductType'])->whereNumber('productTypeId');
    });
});

// ==================== IMÁGENES (servidas con cache) ====================
Route::get('img/{type}/{id}/{slot}', [\App\Http\Controllers\ImageController::class, 'show'])
    ->where('id', '[0-9]+');

// ==================== PUBLICIDAD / ANUNCIOS ====================
Route::get('announcements/active', [\App\Http\Controllers\AnnouncementController::class, 'active']);
Route::prefix('announcements')->middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::get('/', [\App\Http\Controllers\AnnouncementController::class, 'index']);
    Route::post('/', [\App\Http\Controllers\AnnouncementController::class, 'store']);
    Route::put('{id}', [\App\Http\Controllers\AnnouncementController::class, 'update'])->whereNumber('id');
    Route::delete('{id}', [\App\Http\Controllers\AnnouncementController::class, 'destroy'])->whereNumber('id');
});

// ==================== CUPONES / DESCUENTOS ====================
// Validar cupón: opcional autenticado (para límites por usuario) pero accesible a invitados.
Route::post('discounts/validate', [\App\Http\Controllers\DiscountController::class, 'validateCoupon'])
    ->middleware('auth.optional');
Route::prefix('discounts')->middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::get('/', [\App\Http\Controllers\DiscountController::class, 'index']);
    Route::post('/', [\App\Http\Controllers\DiscountController::class, 'store']);
    Route::put('{id}', [\App\Http\Controllers\DiscountController::class, 'update'])->whereNumber('id');
    Route::delete('{id}', [\App\Http\Controllers\DiscountController::class, 'destroy'])->whereNumber('id');
});

// ==================== PRODUCTOS ====================
Route::prefix('products')->group(function () {
    // Lectura pública.
    Route::get('featured', [ProductController::class, 'featured']);
    Route::get('categories', [ProductController::class, 'categories']);
    Route::get('types', [ProductController::class, 'types']);
    Route::get('category/{category}', [ProductController::class, 'byCategory']);
    Route::get('/', [ProductController::class, 'index']);
    Route::get('{id}', [ProductController::class, 'show'])->whereNumber('id');

    // Escritura: solo SuperAdmin.
    Route::middleware(['auth:sanctum', 'admin'])->group(function () {
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
    Route::middleware(['auth:sanctum', 'admin'])->group(function () {
        Route::get('admin/all', [ReviewController::class, 'adminList']);
        Route::patch('admin/{id}/moderate', [ReviewController::class, 'moderate'])->whereNumber('id');
        Route::delete('admin/{id}', [ReviewController::class, 'adminDestroy'])->whereNumber('id');
    });

    // Detalle por ID (pública con auth opcional) — al final por el orden de rutas.
    Route::get('{id}', [ReviewController::class, 'show'])->whereNumber('id')->middleware('auth.optional');
});

// ==================== CARRITO ====================
Route::prefix('cart')->middleware('auth:sanctum')->group(function () {
    Route::get('/', [CartController::class, 'index']);
    Route::delete('/', [CartController::class, 'clearCart']);
    Route::post('items', [CartController::class, 'addItem']);
    Route::put('items/{id}', [CartController::class, 'updateItem'])->whereNumber('id');
    Route::patch('items/{id}/customization', [CartController::class, 'updateItemCustomization'])->whereNumber('id');
    Route::delete('items/{id}', [CartController::class, 'removeItem'])->whereNumber('id');
    Route::post('sync', [CartController::class, 'syncCart']);
});

// ==================== PEDIDOS ====================
Route::prefix('orders')->middleware('auth:sanctum')->group(function () {
    // Usuario.
    Route::get('my', [OrderController::class, 'myOrders']);
    Route::get('my/number/{orderNumber}', [OrderController::class, 'myOrderByNumber']);
    Route::get('my/{id}', [OrderController::class, 'myOrderById'])->whereNumber('id');
    Route::post('my/{id}/cancel', [OrderController::class, 'cancelMyOrder'])->whereNumber('id');
    Route::post('confirm-payment/{orderNumber}', [OrderController::class, 'confirmPayment']);
    Route::post('/', [OrderController::class, 'store']);

    // Admin.
    Route::middleware('admin')->group(function () {
        Route::get('stats', [OrderController::class, 'stats']);
        Route::get('/', [OrderController::class, 'index']);
        Route::get('number/{orderNumber}', [OrderController::class, 'showByNumber']);
        Route::get('{id}', [OrderController::class, 'show'])->whereNumber('id');
        Route::patch('{id}/status', [OrderController::class, 'updateStatus'])->whereNumber('id');
    });
});

// ==================== PAGOS ====================
Route::prefix('payments')->middleware('auth:sanctum')->group(function () {
    Route::post('/', [PaymentController::class, 'store']);
    Route::get('order/{orderId}', [PaymentController::class, 'myOrderPayments'])->whereNumber('orderId');

    Route::middleware('admin')->group(function () {
        Route::get('stats', [PaymentController::class, 'stats']);
        Route::get('all', [PaymentController::class, 'index']);
        Route::get('order/{orderId}/all', [PaymentController::class, 'orderPayments'])->whereNumber('orderId');
        Route::get('transaction/{transactionId}', [PaymentController::class, 'showByTransaction']);
        Route::get('{id}/admin', [PaymentController::class, 'show'])->whereNumber('id');
        Route::patch('{id}/admin', [PaymentController::class, 'update'])->whereNumber('id');
        Route::post('{id}/verify', [PaymentController::class, 'verify'])->whereNumber('id');
        Route::post('{id}/refund', [PaymentController::class, 'refund'])->whereNumber('id');
        Route::post('{id}/cancel', [PaymentController::class, 'cancel'])->whereNumber('id');
    });

    Route::patch('{id}', [PaymentController::class, 'updateMyPayment'])->whereNumber('id');
});

// ==================== WEBHOOKS ====================
Route::prefix('webhooks')->group(function () {
    Route::post('wompi', [WebhookController::class, 'wompi']);
    Route::get('wompi/verify/{transactionId}', [WebhookController::class, 'verifyWompiTransaction'])
        ->middleware(['auth:sanctum', 'admin']);

    // Meta — Messenger (Instagram comparte el mismo endpoint en futuro).
    Route::get('messenger', [WebhookController::class, 'messengerVerify']);
    Route::post('messenger', [WebhookController::class, 'messengerIncoming']);

    // Meta — WhatsApp Cloud API (payload diferente, endpoint separado).
    Route::get('whatsapp', [WebhookController::class, 'whatsappVerify']);
    Route::post('whatsapp', [WebhookController::class, 'whatsappIncoming']);
});

// ==================== TIPOS DE INSUMO ====================
Route::prefix('input-types')->middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::get('/', [InputTypeController::class, 'index']);
    Route::get('{id}', [InputTypeController::class, 'show'])->whereNumber('id');
    Route::post('/', [InputTypeController::class, 'store']);
    Route::put('{id}', [InputTypeController::class, 'update'])->whereNumber('id');
    Route::delete('{id}', [InputTypeController::class, 'destroy'])->whereNumber('id');
});

// ==================== PLANTILLAS (personalizador) ====================
Route::prefix('templates')->group(function () {
    Route::get('public', [TemplateController::class, 'publicList']);
    Route::get('type/{typeSlug}', [TemplateController::class, 'byType']);
    Route::get('{id}', [TemplateController::class, 'show'])->whereNumber('id');
    Route::middleware(['auth:sanctum', 'admin'])->group(function () {
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
    Route::middleware(['auth:sanctum', 'admin'])->group(function () {
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
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/', [TemplateRecipeController::class, 'store']);
        Route::get('variant/{variantId}', [TemplateRecipeController::class, 'byVariant'])->whereNumber('variantId');
        Route::get('product/{productId}/inputs', [TemplateRecipeController::class, 'associatedInputIds'])->whereNumber('productId');
        Route::get('product/{productId}', [TemplateRecipeController::class, 'byProduct'])->whereNumber('productId');
        Route::post('product/{productId}/associate', [TemplateRecipeController::class, 'associateInputs'])->whereNumber('productId');
        Route::delete('variant/{variantId}/input/{inputVariantId}', [TemplateRecipeController::class, 'destroySpecific'])->whereNumber('variantId')->whereNumber('inputVariantId');
        Route::delete('variant/{variantId}', [TemplateRecipeController::class, 'destroyByVariant'])->whereNumber('variantId');
    });
});

// ==================== CONFIGURACIÓN ====================
Route::prefix('settings')->group(function () {
    Route::get('public', [SettingController::class, 'getPublic']);

    Route::middleware(['auth:sanctum', 'admin'])->group(function () {
        $types = 'store|orders|payments|notifications|general|appearance|shipping|home|catalog|legal|printing';
        Route::get('{type}/config', [SettingController::class, 'getConfig'])->where('type', $types);
        Route::put('{type}/config', [SettingController::class, 'updateConfig'])->where('type', $types);
        Route::get('/', [SettingController::class, 'index']);
        Route::get('{key}', [SettingController::class, 'showByKey']);
        Route::put('{key}', [SettingController::class, 'updateByKey']);
    });
});

// ==================== TIPOS DE ZONA ====================
Route::prefix('zone-types')->group(function () {
    Route::get('/', [ZoneTypeController::class, 'index']);
    Route::get('{id}', [ZoneTypeController::class, 'show'])->whereNumber('id');
    Route::middleware(['auth:sanctum', 'admin', 'permission:zone_types.view'])->group(function () {
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
    Route::middleware(['auth:sanctum', 'admin', 'permission:design_images.view'])->group(function () {
        Route::post('/', [DesignImageController::class, 'store']);
        Route::put('sort-order', [DesignImageController::class, 'updateSortOrder']);
        Route::put('{id}', [DesignImageController::class, 'update'])->whereNumber('id');
        Route::delete('{id}', [DesignImageController::class, 'destroy'])->whereNumber('id');
    });
});

// ==================== INSUMOS ====================
Route::prefix('inputs')->middleware(['auth:sanctum', 'admin'])->group(function () {
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

// ==================== ÓRDENES DE COMPRA ====================
Route::prefix('purchase-orders')->middleware('auth:sanctum')->group(function () {
    Route::get('stats', [PurchaseOrderController::class, 'stats'])->middleware('permission:purchase_orders.view');
    Route::get('generate-number', [PurchaseOrderController::class, 'generateNumber'])->middleware('permission:purchase_orders.view');
    Route::get('/', [PurchaseOrderController::class, 'index'])->middleware('permission:purchase_orders.view');
    Route::get('{id}', [PurchaseOrderController::class, 'show'])->whereNumber('id')->middleware('permission:purchase_orders.view');
    Route::post('/', [PurchaseOrderController::class, 'store'])->middleware('permission:purchase_orders.view');
    Route::put('{id}', [PurchaseOrderController::class, 'update'])->whereNumber('id')->middleware('permission:purchase_orders.view');
    Route::patch('{id}/status', [PurchaseOrderController::class, 'updateStatus'])->whereNumber('id')->middleware('permission:purchase_orders.view');
    Route::post('{id}/receive', [PurchaseOrderController::class, 'receive'])->whereNumber('id')->middleware('permission:purchase_orders.view');
    // Eliminar una orden de compra: solo el administrador (SuperAdmin).
    Route::delete('{id}', [PurchaseOrderController::class, 'destroy'])->whereNumber('id')->middleware('admin');
});

// ==================== DEVOLUCIONES DE COMPRA ====================
Route::prefix('purchase-returns')->middleware('auth:sanctum')->group(function () {
    Route::get('stats', [PurchaseReturnController::class, 'stats'])->middleware('permission:purchase_returns.view');
    Route::get('generate-number', [PurchaseReturnController::class, 'generateNumber'])->middleware('permission:purchase_returns.view');
    Route::get('returnable/{purchaseOrderId}', [PurchaseReturnController::class, 'returnableItems'])
        ->whereNumber('purchaseOrderId')->middleware('permission:purchase_returns.view');
    Route::get('/', [PurchaseReturnController::class, 'index'])->middleware('permission:purchase_returns.view');
    Route::get('{id}', [PurchaseReturnController::class, 'show'])->whereNumber('id')->middleware('permission:purchase_returns.view');
    Route::post('/', [PurchaseReturnController::class, 'store'])->middleware('permission:purchase_returns.view');
});

// ==================== LOTES DE INSUMO ====================
Route::prefix('input-batches')->middleware(['auth:sanctum', 'admin'])->group(function () {
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

// ==================== PROVEEDORES ====================
Route::prefix('suppliers')->middleware('auth:sanctum')->group(function () {
    Route::get('stats', [SupplierController::class, 'stats'])->middleware('permission:suppliers.view');
    Route::get('generate-code', [SupplierController::class, 'generateCode'])->middleware('permission:suppliers.view');
    Route::get('/', [SupplierController::class, 'index'])->middleware('permission:suppliers.view');
    Route::get('{id}', [SupplierController::class, 'show'])->whereNumber('id')->middleware('permission:suppliers.view');
    Route::post('/', [SupplierController::class, 'store'])->middleware('permission:suppliers.view');
    Route::put('{id}', [SupplierController::class, 'update'])->whereNumber('id')->middleware('permission:suppliers.view');
    Route::delete('{id}', [SupplierController::class, 'destroy'])->whereNumber('id')->middleware('permission:suppliers.view');
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

// ==================== ENVÍOS ====================
Route::prefix('shipping')->middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::post('sync-rates', [\App\Http\Controllers\ShippingController::class, 'syncRates']);
});

// ==================== SUBIDA DE IMÁGENES ====================
Route::prefix('uploads')->group(function () {
    Route::get('optimize', [UploadController::class, 'getOptimizedUrl']);
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('image', [UploadController::class, 'uploadImage']);
        Route::post('images', [UploadController::class, 'uploadMultipleImages']);
        Route::post('from-url', [UploadController::class, 'uploadFromUrl']);
        Route::post('base64', [UploadController::class, 'uploadBase64']);
        Route::delete('{publicId}', [UploadController::class, 'deleteImage'])
            ->where('publicId', '.*')->middleware('admin');
    });
});

// ==================== CAJAS REGISTRADORAS ====================
Route::prefix('cash-registers')->middleware('auth:sanctum')->group(function () {
    Route::get('/', [CashRegisterController::class, 'index'])->middleware('permission:pos.cash_register,pos.access');
    Route::get('my-session', [CashRegisterController::class, 'mySession'])->middleware('permission:pos.access');
    // Sesiones — antes de /{id} para evitar conflictos de ruta.
    Route::get('sessions', [CashRegisterController::class, 'listSessions'])->middleware('permission:pos.view_reports,pos.cash_register');
    Route::get('sessions/{id}/report', [CashRegisterController::class, 'sessionReport'])
        ->whereNumber('id')->middleware('permission:pos.view_reports,pos.cash_register');
    Route::post('sessions/{id}/close', [CashRegisterController::class, 'closeSession'])
        ->whereNumber('id')->middleware('permission:pos.open_close_session,pos.access');
    Route::get('{id}', [CashRegisterController::class, 'show'])->whereNumber('id')->middleware('permission:pos.cash_register,pos.access');
    Route::post('/', [CashRegisterController::class, 'store'])->middleware('permission:pos.cash_register');
    Route::patch('{id}', [CashRegisterController::class, 'update'])->whereNumber('id')->middleware('permission:pos.cash_register');
    Route::delete('{id}', [CashRegisterController::class, 'destroy'])->whereNumber('id')->middleware('permission:pos.cash_register');
    Route::post('{id}/open-session', [CashRegisterController::class, 'openSession'])
        ->whereNumber('id')->middleware('permission:pos.open_close_session,pos.access');
});

// ==================== PUNTO DE VENTA (POS) ====================
Route::prefix('pos')->middleware('auth:sanctum')->group(function () {
    Route::post('scan', [POSController::class, 'scan'])->middleware('permission:pos.access,pos.create_sale');
    Route::post('search', [POSController::class, 'search'])->middleware('permission:pos.access,pos.create_sale');
    Route::get('products', [POSController::class, 'products'])->middleware('permission:pos.access,pos.create_sale');
    Route::post('calculate', [POSController::class, 'calculate'])->middleware('permission:pos.access,pos.create_sale');
    Route::post('sale', [POSController::class, 'createSale'])->middleware('permission:pos.access,pos.create_sale');
    Route::post('sale/{id}/cancel', [POSController::class, 'cancelSale'])->whereNumber('id')->middleware('permission:pos.access,pos.cancel_sale');
    Route::post('sale/{id}/return', [POSController::class, 'returnSale'])->whereNumber('id')->middleware('permission:pos.access,pos.cancel_sale');
    Route::put('sale/{id}', [POSController::class, 'updateSale'])->whereNumber('id')->middleware('permission:pos.access,pos.create_sale');
    Route::get('sales', [POSController::class, 'salesHistory'])->middleware('permission:pos.access,pos.view_sales');
    Route::get('stats', [POSController::class, 'stats'])->middleware('permission:pos.access,pos.view_sales');
    Route::get('debts', [POSController::class, 'debts'])->middleware('permission:pos.access,pos.view_sales');
    Route::post('sale/{id}/collect', [POSController::class, 'collectDebt'])->whereNumber('id')->middleware('permission:pos.access,pos.create_sale');
    Route::get('customer/search', [POSController::class, 'customerSearch'])->middleware('permission:pos.access,pos.create_sale');
    Route::get('customers', [POSController::class, 'customers'])->middleware('permission:pos.access,pos.view_sales');
    Route::get('customers/{id}', [POSController::class, 'customerDetail'])->whereNumber('id')->middleware('permission:pos.access,pos.view_sales');
    Route::get('sale/{id}', [POSController::class, 'saleDetail'])->whereNumber('id')->middleware('permission:pos.access,pos.view_sales');
    Route::post('sale/{id}/send-invoice', [POSController::class, 'sendInvoice'])->whereNumber('id')->middleware('permission:pos.access,pos.view_sales');
    Route::get('sale/{id}/invoice-pdf', [POSController::class, 'invoicePdf'])->whereNumber('id')->middleware('permission:pos.access,pos.view_sales');
    Route::post('sale/{id}/payment-evidence', [POSController::class, 'uploadPaymentEvidence'])->whereNumber('id')->middleware('permission:pos.access,pos.create_sale');
    Route::get('sale/{id}/payment-evidence', [POSController::class, 'getPaymentEvidence'])->whereNumber('id')->middleware('permission:pos.access,pos.view_sales');
});

// ==================== PLANTILLAS DE ETIQUETAS ====================
Route::prefix('label-templates')->middleware('auth:sanctum')->group(function () {
    Route::get('/', [LabelTemplateController::class, 'index'])->middleware('permission:settings.general');
    Route::get('product-type/{productTypeId}', [LabelTemplateController::class, 'forProductType'])
        ->whereNumber('productTypeId')->middleware('permission:settings.general');
    Route::get('{id}', [LabelTemplateController::class, 'show'])->whereNumber('id')->middleware('permission:settings.general');
    Route::post('/', [LabelTemplateController::class, 'store'])->middleware('permission:settings.general');
    Route::patch('{id}', [LabelTemplateController::class, 'update'])->whereNumber('id')->middleware('permission:settings.general');
    Route::delete('{id}', [LabelTemplateController::class, 'destroy'])->whereNumber('id')->middleware('permission:settings.general');
    Route::post('{id}/duplicate', [LabelTemplateController::class, 'duplicate'])->whereNumber('id')->middleware('permission:settings.general');

    Route::middleware('permission:settings.general')->group(function () {
        Route::post('{templateId}/zones', [LabelTemplateController::class, 'createZone'])->whereNumber('templateId');
        Route::patch('{templateId}/zones/batch', [LabelTemplateController::class, 'updateZonesBatch'])->whereNumber('templateId');
        Route::patch('zones/{zoneId}', [LabelTemplateController::class, 'updateZone'])->whereNumber('zoneId');
        Route::delete('zones/{zoneId}', [LabelTemplateController::class, 'deleteZone'])->whereNumber('zoneId');
    });
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
Route::prefix('messaging')->middleware(['auth:sanctum', 'admin', 'permission:messaging.access'])->group(function () {
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
Route::prefix('webchat')->group(function () {
    Route::post('start', [WebChatController::class, 'start']);
    Route::post('send', [WebChatController::class, 'send']);
    Route::get('poll', [WebChatController::class, 'poll']);
});
// Rutas de depuración opcionales (archivo ignorado por git; solo en local).
if (file_exists(__DIR__."/debug-ai.php")) {
    require __DIR__."/debug-ai.php";
}
