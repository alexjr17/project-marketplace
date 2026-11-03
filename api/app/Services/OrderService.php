<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\Discount;
use App\Models\InputVariant;
use App\Models\Notification;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductInput;
use App\Models\ProductVariant;
use App\Models\Setting;
use App\Models\TemplateRecipe;
use App\Models\VariantMovement;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * Lógica de pedidos: checkout, cálculo de totales, control de stock,
 * transiciones de estado y consumo/restauración de insumos.
 */
class OrderService
{
    private const STATUS_LABELS = [
        'PENDING' => 'Pendiente',
        'PAID' => 'Pagado',
        'PROCESSING' => 'En Proceso',
        'SHIPPED' => 'Enviado',
        'DELIVERED' => 'Entregado',
        'CANCELLED' => 'Cancelado',
    ];

    private const VALID_TRANSITIONS = [
        'PENDING' => ['PAID', 'CANCELLED'],
        // Despachos envía directamente los pedidos pagados (sin pasar por "En proceso").
        'PAID' => ['PROCESSING', 'SHIPPED', 'CANCELLED'],
        'PROCESSING' => ['SHIPPED', 'CANCELLED'],
        'SHIPPED' => ['DELIVERED'],
        'DELIVERED' => [],
        'CANCELLED' => [],
    ];

    public function __construct(
        private TemplateStockService $templateStock,
        private DiscountService $discounts,
        private ShippingQuoteService $shippingQuotes,
        private NumberSequenceService $numbers,
        private StockService $stock,
        private CustomizationPricingService $customPricing,
    ) {}

    /** Primera imagen utilizable de un producto ({front,...} u array). */
    private function firstImage($images): string
    {
        if (is_string($images)) {
            $decoded = json_decode($images, true);
            $images = is_array($decoded) ? $decoded : [];
        }
        if (! is_array($images)) {
            return '';
        }
        if (is_string($images['front'] ?? null) && $images['front'] !== '') {
            return $images['front'];
        }
        foreach ($images as $v) {
            if (is_string($v) && $v !== '') {
                return $v;
            }
        }

        return '';
    }

    /** Da formato a un pedido para la respuesta de la API. */
    public function formatOrder(Order $order): array
    {
        $items = $order->items->map(function ($item) {
            // Si el ítem no guardó imagen, usar la imagen actual del producto.
            $image = $item->productImage;
            if (empty($image)) {
                $image = $this->firstImage($item->product?->images);
            }

            return [
                'id' => $item->id,
                'productId' => $item->productId,
                'productName' => $item->productName,
                'productImage' => $image,
                'size' => $item->size,
                'color' => $item->color,
                'quantity' => $item->quantity,
                'unitPrice' => (float) $item->unitPrice,
                'subtotal' => (float) $item->unitPrice * $item->quantity,
                'customization' => $item->customization,
            ];
        })->all();

        return [
            'id' => $order->id,
            'orderNumber' => $order->orderNumber,
            'userId' => $order->userId,
            'userName' => $order->user?->name,
            'userEmail' => $order->user?->email,
            'items' => $items,
            'subtotal' => (float) $order->subtotal,
            'shippingCost' => (float) $order->shippingCost,
            'discount' => (float) $order->discount,
            'couponCode' => $order->couponCode,
            'tax' => (float) $order->tax,
            'total' => (float) $order->total,
            'status' => $order->status,
            'statusLabel' => self::STATUS_LABELS[$order->status] ?? $order->status,
            'paymentMethod' => $order->paymentMethod,
            'paymentRef' => $order->paymentRef,
            'shipping' => $order->shipping,
            'trackingNumber' => $order->trackingNumber,
            'trackingUrl' => $order->trackingUrl,
            'notes' => $order->notes,
            'statusHistory' => $order->statusHistory,
            'paidAt' => $order->paidAt,
            'shippedAt' => $order->shippedAt,
            'deliveredAt' => $order->deliveredAt,
            'createdAt' => $order->createdAt,
            'updatedAt' => $order->updatedAt,
        ];
    }

    private function getSettings(): array
    {
        $order = Setting::where('key', 'order_settings')->value('value') ?? [];
        $payment = Setting::where('key', 'payment_settings')->value('value') ?? [];

        $taxRate = $payment['taxRate'] ?? $order['taxRate'] ?? 19;
        if ($taxRate > 1) {
            $taxRate /= 100;
        }

        return [
            'shippingCost' => $order['shippingCost'] ?? 12000,
            'taxRate' => $taxRate,
            'freeShippingThreshold' => $order['freeShippingThreshold'] ?? 150000,
            'taxEnabled' => $payment['taxEnabled'] ?? false,
            'taxIncluded' => $payment['taxIncluded'] ?? true,
        ];
    }

    /** Crea un pedido a partir del checkout. */
    public function createOrder(int $userId, array $data): Order
    {
        $settings = $this->getSettings();
        $autoDiscounts = $this->discounts->activeAutoDiscounts('online'); // ofertas automáticas vigentes
        $subtotal = 0;
        $orderItems = [];
        $stockUpdates = [];
        $couponItems = []; // contexto para validar cupones (producto/categoría)
        $requested = []; // variantId => cantidad total pedida (suma líneas repetidas)

        foreach ($data['items'] as $item) {
            $product = Product::with('variants.color', 'variants.size')->find($item['productId']);
            if (! $product) {
                throw new RuntimeException("Producto {$item['productId']} no encontrado", 404);
            }
            if (! $product->isActive) {
                throw new RuntimeException("El producto \"{$product->name}\" no está disponible");
            }

            $customization = $item['customization'] ?? null;
            $variant = $product->isTemplate ? $this->templateVariantByIds($product, $customization) : null;
            if (! $variant) {
                $itemColor = strtolower((string) ($item['color'] ?? ''));
                $itemSize = (string) ($item['size'] ?? '');
                $variant = $product->variants->first(function ($v) use ($itemColor, $itemSize) {
                    // Vacío/null se tratan igual (producto simple sin color/talla).
                    $colorMatch = strtolower((string) $v->color?->hexCode) === $itemColor;
                    $sizeMatch = (string) ($v->size?->name ?? '') === $itemSize
                        || (string) ($v->size?->abbreviation ?? '') === $itemSize;

                    return $colorMatch && $sizeMatch;
                });
            }

            if (! $variant) {
                throw new RuntimeException(
                    "No se encontró variante para \"{$product->name}\" con color {$item['color']} y talla {$item['size']}"
                );
            }

            $requested[$variant->id] = ($requested[$variant->id] ?? 0) + $item['quantity'];
            // Plantilla sin receta ni insumo asociado: su stock es el de la variante y se descuenta
            // al crear el pedido, igual que un producto normal.
            $templateFromInputs = $product->isTemplate
                && $this->templateStock->stockSource($variant) !== TemplateStockService::SOURCE_VARIANT;
            if ($templateFromInputs) {
                $available = $this->templateStock->getAvailableStockForTemplate($variant->id);
                if ($available < $requested[$variant->id]) {
                    throw new RuntimeException(
                        "Stock insuficiente para \"{$product->name}\" ({$item['size']}, {$item['color']}). Disponible: {$available}"
                    );
                }
            } elseif ($variant->stock < $requested[$variant->id]) {
                throw new RuntimeException(
                    "Stock insuficiente para \"{$product->name}\" ({$item['size']}, {$item['color']}). Disponible: {$variant->stock}"
                );
            }

            $stockUpdates[] = [
                'variantId' => $variant->id,
                'quantity' => $item['quantity'],
                // Las plantillas con receta/insumo se consumen al pagar, no aquí.
                'fromInputs' => $templateFromInputs,
            ];

            // Precio con la oferta automática aplicada (si alguna le aplica). Personalizado (v2):
            // + el precio de las zonas diseñadas, calculado aquí (no se usa el que manda el cliente).
            $salePrice = $this->discounts->autoPrice($product, $autoDiscounts);
            $quote = $product->isTemplate
                ? $this->customPricing->quoteForCustomization($product, $customization, $autoDiscounts)
                : null;
            $unitPrice = $quote ? $quote['total'] : $salePrice;
            $subtotal += $unitPrice * $item['quantity'];

            $couponItems[] = [
                'productId' => $product->id,
                'categoryId' => $product->categoryId,
                'price' => $unitPrice,
                'quantity' => (int) $item['quantity'],
                // Si el producto ya trae oferta automática, el cupón no se acumula.
                'discounted' => $salePrice < (float) $product->basePrice,
            ];

            $firstImage = $this->firstImage($product->images);

            $orderItems[] = [
                'productId' => $product->id,
                'productName' => $product->name,
                'productImage' => $firstImage,
                // Columnas NOT NULL: productos simples van con cadena vacía.
                'size' => (string) ($item['size'] ?? ''),
                'color' => (string) ($item['color'] ?? ''),
                'variantId' => $variant->id,
                'quantity' => $item['quantity'],
                'unitPrice' => $unitPrice,
                'customization' => $quote
                    ? array_merge($customization, [
                        'customizationPrice' => $quote['customizationPrice'],
                        'totalPrice' => $quote['total'],
                    ])
                    : $customization,
            ];
        }

        // Envío por zona y transportadora (igual que el checkout); si no se puede cotizar,
        // la tarifa fija de respaldo. Antes siempre se cobraba la fija y no coincidía con lo
        // que el cliente veía.
        $shippingSettings = $this->shippingQuotes->settings();
        $totalItems = (int) array_sum(array_column($data['items'], 'quantity'));
        $quoted = $this->shippingQuotes->quote(
            $shippingSettings,
            (string) ($data['shipping']['city'] ?? ''),
            $this->shippingQuotes->packageWeight($shippingSettings, $totalItems),
            $subtotal,
        );
        $shippingCost = $quoted ?? ($subtotal >= $settings['freeShippingThreshold'] ? 0 : $settings['shippingCost']);
        $tax = ($settings['taxEnabled'] && ! $settings['taxIncluded'])
            ? round($subtotal * $settings['taxRate'])
            : 0;

        // Cupón (opcional): valida y calcula el descuento sobre el subtotal elegible.
        $discount = 0;
        $discountModel = null;
        $couponCode = null;
        if (! empty($data['couponCode'])) {
            $result = $this->discounts->validate($data['couponCode'], [
                'subtotal' => $subtotal,
                'items' => $couponItems,
                'userId' => $userId,
                'channel' => 'online',
            ]);
            $discountModel = $result['discount'];
            $discount = $result['amount'];
            $couponCode = $discountModel->code;
        }

        $total = max(0, $subtotal + $shippingCost + $tax - $discount);

        return DB::transaction(function () use (
            $userId, $data, $subtotal, $shippingCost, $tax, $total,
            $discount, $discountModel, $couponCode, $orderItems, $stockUpdates
        ) {
            $orderNumber = $this->numbers->next(NumberSequenceService::ORDER);
            $order = Order::create([
                'orderNumber' => $orderNumber,
                'userId' => $userId,
                'subtotal' => $subtotal,
                'shippingCost' => $shippingCost,
                'discount' => $discount,
                'discountId' => $discountModel?->id,
                'couponCode' => $couponCode,
                'tax' => $tax,
                'total' => $total,
                'status' => 'PENDING',
                'paymentMethod' => $data['paymentMethod'],
                'paymentRef' => $data['paymentRef'] ?? null,
                'shipping' => $data['shipping'],
                'notes' => $data['notes'] ?? null,
                'statusHistory' => [[
                    'status' => 'PENDING',
                    'timestamp' => now()->toIso8601String(),
                    'note' => 'Pedido creado',
                ]],
            ]);

            foreach ($orderItems as $oi) {
                OrderItem::create($oi + ['orderId' => $order->id]);
            }

            // Registrar el uso del cupón.
            if ($discountModel) {
                $this->discounts->redeem($discountModel);
            }

            // Descontar stock de productos regulares y de plantillas sin receta (las plantillas con
            // receta o insumo asociado consumen sus insumos al pagar).
            foreach ($stockUpdates as $su) {
                if ($su['fromInputs']) {
                    continue;
                }
                // Con bloqueo de fila: si otro pedido se llevó el stock entre la validación y
                // aquí, falla (400) en vez de dejar la variante en negativo.
                $this->stock->variantOut($su['variantId'], $su['quantity'], 'SALE', [
                    'referenceType' => 'order',
                    'referenceId' => $order->id,
                    'reason' => "Venta online - Orden {$orderNumber}",
                ]);
            }

            return $order->load(['items.product:id,images', 'user']);
        });
    }

    /** Lista pedidos con filtros y paginación. */
    public function listOrders(array $query): array
    {
        $page = max(1, (int) ($query['page'] ?? 1));
        // Tope de página: sin él se podía descargar toda la tabla en una petición.
        $limit = min(100, max(1, (int) ($query['limit'] ?? 10)));

        $builder = Order::with(['items.product:id,images', 'user']);

        if (! empty($query['status'])) {
            $builder->where('status', $query['status']);
        }
        if (! empty($query['userId'])) {
            $builder->where('userId', $query['userId']);
        }
        if (! empty($query['startDate'])) {
            $builder->where('createdAt', '>=', $query['startDate']);
        }
        if (! empty($query['endDate'])) {
            $builder->where('createdAt', '<=', $query['endDate']);
        }
        if (! empty($query['search'])) {
            $s = $query['search'];
            $builder->where(function ($q) use ($s) {
                $q->where('orderNumber', 'like', "%{$s}%")
                    ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$s}%")
                        ->orWhere('email', 'like', "%{$s}%"));
            });
        }

        $sortBy = in_array($query['sortBy'] ?? '', ['createdAt', 'total', 'status', 'orderNumber'], true)
            ? $query['sortBy'] : 'createdAt';
        $sortOrder = ($query['sortOrder'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        $total = $builder->count();
        $orders = $builder->orderBy($sortBy, $sortOrder)
            ->skip(($page - 1) * $limit)->take($limit)->get();

        return [
            'data' => $orders->map(fn ($o) => $this->formatOrder($o))->all(),
            'meta' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => (int) ceil($total / $limit),
            ],
        ];
    }

    public function getOrderById(int $id, ?int $userId = null): Order
    {
        $order = Order::with(['items.product:id,images', 'user'])->find($id);
        if (! $order || ($userId && $order->userId !== $userId)) {
            throw new RuntimeException('Pedido no encontrado', 404);
        }

        return $order;
    }

    public function getOrderByNumber(string $orderNumber, ?int $userId = null): Order
    {
        $order = Order::with(['items.product:id,images', 'user'])->where('orderNumber', $orderNumber)->first();
        if (! $order || ($userId && $order->userId !== $userId)) {
            throw new RuntimeException('Pedido no encontrado', 404);
        }

        return $order;
    }

    /** Actualiza el estado de un pedido y aplica los efectos de inventario. */
    public function updateOrderStatus(int $id, array $data): Order
    {
        $order = Order::find($id);
        if (! $order) {
            throw new RuntimeException('Pedido no encontrado', 404);
        }

        $newStatus = $data['status'];
        if (! in_array($newStatus, self::VALID_TRANSITIONS[$order->status] ?? [], true)) {
            $from = self::STATUS_LABELS[$order->status] ?? $order->status;
            $to = self::STATUS_LABELS[$newStatus] ?? $newStatus;
            throw new RuntimeException("No se puede cambiar de {$from} a {$to}");
        }

        DB::transaction(function () use ($order, $data, $newStatus) {
            $history = is_array($order->statusHistory) ? $order->statusHistory : [];
            $history[] = [
                'status' => $newStatus,
                'timestamp' => now()->toIso8601String(),
                'note' => $data['notes'] ?? ('Estado cambiado a '.(self::STATUS_LABELS[$newStatus] ?? $newStatus)),
            ];
            $order->statusHistory = $history;
            $order->status = $newStatus;

            if ($newStatus === 'PAID') {
                $order->paidAt = now();
                $this->consumeTemplateInputs($order);
            } elseif ($newStatus === 'SHIPPED') {
                $order->shippedAt = now();
                if (! empty($data['trackingNumber'])) {
                    $order->trackingNumber = $data['trackingNumber'];
                }
                if (! empty($data['trackingUrl'])) {
                    $order->trackingUrl = $data['trackingUrl'];
                }
            } elseif ($newStatus === 'DELIVERED') {
                $order->deliveredAt = now();
                if ($order->userId) {
                    $this->createReviewNotifications($order);
                }
            } elseif ($newStatus === 'CANCELLED') {
                $this->restoreStock($order);
                $this->releaseOrderResources($order);
            }

            $order->save();
        });

        return $order->load(['items.product:id,images', 'user']);
    }

    /**
     * Al cancelar: devuelve el uso del cupón y cancela los pagos aún pendientes del pedido
     * (antes el cupón quedaba gastado y el pago seguía "pendiente" en el módulo Pagos).
     */
    private function releaseOrderResources(Order $order): void
    {
        if ($order->discountId && ($discount = Discount::find($order->discountId))) {
            $this->discounts->release($discount);
        }
        Payment::where('orderId', $order->id)
            ->whereIn('status', ['PENDING', 'PROCESSING'])
            ->update(['status' => 'CANCELLED', 'cancelledAt' => now()]);
    }

    /**
     * Pago aprobado por la pasarela sobre un pedido YA CANCELADO (p. ej. un PSE que se aprobó
     * después de que el cliente cambió de dirección y el checkout canceló el pedido). No se
     * reabre el pedido (su stock ya se devolvió): se registra el pago como aprobado con nota
     * de reembolso y queda en el historial, para que el admin lo vea en Pagos y lo devuelva.
     */
    public function recordPaymentOnCancelledOrder(Order $order, string $method, string $transactionId, float $amount): void
    {
        Payment::updateOrCreate(
            ['transactionId' => $transactionId],
            [
                'orderId' => $order->id,
                'paymentMethod' => $method,
                'amount' => $amount,
                'currency' => 'COP',
                'status' => 'APPROVED',
                'paidAt' => now(),
                'payerName' => $order->customerName ?? $order->user?->name,
                'payerEmail' => $order->customerEmail ?? $order->user?->email,
                'notes' => 'Pago aprobado sobre un pedido cancelado: requiere reembolso.',
            ],
        );
        $history = is_array($order->statusHistory) ? $order->statusHistory : [];
        $history[] = [
            'status' => 'CANCELLED',
            'timestamp' => now()->toIso8601String(),
            'note' => "Pago {$method} aprobado ({$transactionId}) con el pedido cancelado: requiere reembolso.",
        ];
        $order->statusHistory = $history;
        $order->save();
        Log::warning("Pago {$method} aprobado sobre el pedido cancelado {$order->orderNumber}: requiere reembolso.");
    }

    public function cancelOrder(int $id, int $userId): Order
    {
        $order = Order::find($id);
        if (! $order || $order->userId !== $userId) {
            throw new RuntimeException('Pedido no encontrado', 404);
        }
        if ($order->status !== 'PENDING') {
            throw new RuntimeException('Solo se pueden cancelar pedidos pendientes');
        }

        return $this->updateOrderStatus($id, ['status' => 'CANCELLED', 'notes' => 'Cancelado por el usuario']);
    }

    public function getStats(): array
    {
        $counts = Order::selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status');
        $revenue = Order::whereIn('status', ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'])->sum('total');

        return [
            'total' => Order::count(),
            'byStatus' => [
                'pending' => (int) ($counts['PENDING'] ?? 0),
                'processing' => (int) ($counts['PROCESSING'] ?? 0),
                'shipped' => (int) ($counts['SHIPPED'] ?? 0),
                'delivered' => (int) ($counts['DELIVERED'] ?? 0),
                'cancelled' => (int) ($counts['CANCELLED'] ?? 0),
            ],
            'revenue' => (float) $revenue,
        ];
    }

    /** Busca la variante de un order item por color (hex) y talla. */
    private function findVariant(Product $product, OrderItem $item): ?ProductVariant
    {
        // La variante quedó guardada al crear el pedido (los personalizados la eligen por id).
        if ($item->variantId && ($byId = $product->variants->firstWhere('id', $item->variantId))) {
            return $byId;
        }

        $itemColor = strtolower((string) ($item->color ?? ''));
        $itemSize = (string) ($item->size ?? '');

        return $product->variants->first(function ($v) use ($itemColor, $itemSize) {
            $colorMatch = strtolower((string) $v->color?->hexCode) === $itemColor;
            $sizeMatch = (string) ($v->size?->name ?? '') === $itemSize
                || (string) ($v->size?->abbreviation ?? '') === $itemSize;

            return $colorMatch && $sizeMatch;
        });
    }

    /** Consume insumos de las plantillas cuando el pedido se marca como pagado. */
    private function consumeTemplateInputs(Order $order): void
    {
        foreach (OrderItem::where('orderId', $order->id)->get() as $item) {
            $product = Product::with('variants.color', 'variants.size')->find($item->productId);
            if (! $product?->isTemplate) {
                continue;
            }
            $variant = $this->findVariant($product, $item);
            if (! $variant || $this->soldFromVariantStock($order, $variant)) {
                continue; // sin receta: su stock ya se descontó de la variante al crear el pedido
            }

            $recipes = TemplateRecipe::where('variantId', $variant->id)->get();
            if ($recipes->isNotEmpty()) {
                foreach ($recipes as $recipe) {
                    $this->moveInputStock(
                        $recipe->inputVariantId,
                        -((float) $recipe->quantity * $item->quantity),
                        'SALIDA', 'order', $order->id,
                        "Venta online - Orden {$order->orderNumber} - Template {$product->name}"
                    );
                }

                continue;
            }

            // Fallback: matching por color/talla con ProductInput.
            $match = $this->templateStock->matchingInputVariant($variant);
            if ($match) {
                $this->moveInputStock(
                    $match->id, -$item->quantity, 'SALIDA', 'order', $order->id,
                    "Venta online - Orden {$order->orderNumber} - Template {$product->name} (fallback)"
                );
            }
        }
    }

    /** Restaura stock al cancelar un pedido. */
    private function restoreStock(Order $order): void
    {
        $wasPaid = in_array($order->status === 'CANCELLED' ? '' : $order->status, [], true);
        // El estado anterior se conserva: cuando llega aquí, $order->status aún es el previo.
        $wasPaid = in_array($order->getOriginal('status'), ['PAID', 'PROCESSING', 'SHIPPED'], true);

        foreach (OrderItem::where('orderId', $order->id)->get() as $item) {
            $product = Product::with('variants.color', 'variants.size')->find($item->productId);
            if (! $product) {
                continue;
            }
            $variant = $this->findVariant($product, $item);
            if (! $variant) {
                continue;
            }

            // Plantillas con receta/insumo: se devuelven los insumos si ya se habían consumido.
            // Sin receta (vendida del stock de la variante): se devuelve a la variante como un
            // producto normal (rama de abajo).
            if ($product->isTemplate && ! $this->soldFromVariantStock($order, $variant)) {
                if (! $wasPaid) {
                    continue;
                }
                $recipes = TemplateRecipe::where('variantId', $variant->id)->get();
                if ($recipes->isNotEmpty()) {
                    foreach ($recipes as $recipe) {
                        $this->moveInputStock(
                            $recipe->inputVariantId,
                            (float) $recipe->quantity * $item->quantity,
                            'DEVOLUCION', 'order_cancel', $order->id,
                            "Cancelación orden {$order->orderNumber} - Template {$product->name}"
                        );
                    }
                } else {
                    $match = $this->templateStock->matchingInputVariant($variant);
                    if ($match) {
                        $this->moveInputStock(
                            $match->id, $item->quantity, 'DEVOLUCION', 'order_cancel', $order->id,
                            "Cancelación orden {$order->orderNumber} - Template {$product->name} (fallback)"
                        );
                    }
                }
            } else {
                $this->stock->variantIn($variant->id, $item->quantity, 'RETURN', [
                    'referenceType' => 'order_cancel',
                    'referenceId' => $order->id,
                    'reason' => "Cancelación orden {$order->orderNumber}",
                ]);
            }
        }
    }

    /**
     * Variante de una plantilla por los ids de la personalización v2 (colorId/sizeId).
     * Ids que no son de una variante de la plantilla → 422. Sin ids → null (se busca por
     * color/talla como siempre).
     */
    private function templateVariantByIds(Product $product, mixed $customization): ?ProductVariant
    {
        if (! is_array($customization) || empty($customization['colorId']) || empty($customization['sizeId'])) {
            return null;
        }
        $colorId = (int) $customization['colorId'];
        $sizeId = (int) $customization['sizeId'];

        $variant = $product->variants->first(fn ($v) => (int) $v->colorId === $colorId && (int) $v->sizeId === $sizeId);
        if (! $variant) {
            throw ValidationException::withMessages([
                'items' => "La combinación de color y talla elegida no existe para \"{$product->name}\".",
            ]);
        }

        return $variant;
    }

    /** ¿Esta línea de plantilla se vendió del stock de la variante (sin receta) en este pedido? */
    private function soldFromVariantStock(Order $order, ProductVariant $variant): bool
    {
        return VariantMovement::where('variantId', $variant->id)
            ->where('referenceType', 'order')
            ->where('referenceId', $order->id)
            ->where('movementType', 'SALE')
            ->exists();
    }

    private function moveInputStock(int $inputVariantId, float $delta, string $type, string $refType, int $refId, string $reason): void
    {
        if (! InputVariant::whereKey($inputVariantId)->exists()) {
            return;
        }
        $attrs = ['referenceType' => $refType, 'referenceId' => $refId, 'reason' => $reason];

        // El consumo de plantillas ocurre al confirmarse el pago: no puede fallar por stock.
        $delta < 0
            ? $this->stock->inputVariantOut($inputVariantId, -$delta, $type, $attrs, allowNegative: true)
            : $this->stock->inputVariantIn($inputVariantId, $delta, $type, $attrs);
    }

    /** Crea notificaciones de reseña para los productos de un pedido entregado. */
    private function createReviewNotifications(Order $order): void
    {
        $productIds = OrderItem::where('orderId', $order->id)->pluck('productId')->unique();
        foreach ($productIds as $productId) {
            $product = Product::find($productId);
            if (! $product) {
                continue;
            }
            $already = Notification::where('userId', $order->userId)
                ->where('type', 'REVIEW_AVAILABLE')
                ->where('referenceType', 'product')
                ->where('referenceId', $productId)
                ->exists();
            if ($already) {
                continue;
            }
            Notification::create([
                'userId' => $order->userId,
                'type' => 'REVIEW_AVAILABLE',
                'title' => '¡Califica tu compra!',
                'message' => "Cuéntanos qué te pareció \"{$product->name}\". Tu opinión ayuda a otros compradores.",
                'referenceType' => 'product',
                'referenceId' => $productId,
                'isRead' => false,
            ]);
        }
    }
}
