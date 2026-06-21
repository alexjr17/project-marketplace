<?php

namespace App\Services;

use App\Models\InputVariant;
use App\Models\InputVariantMovement;
use App\Models\Notification;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductInput;
use App\Models\ProductVariant;
use App\Models\Setting;
use App\Models\TemplateRecipe;
use App\Models\VariantMovement;
use Illuminate\Support\Facades\DB;
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
        'PAID' => ['PROCESSING', 'CANCELLED'],
        'PROCESSING' => ['SHIPPED', 'CANCELLED'],
        'SHIPPED' => ['DELIVERED'],
        'DELIVERED' => [],
        'CANCELLED' => [],
    ];

    public function __construct(private TemplateStockService $templateStock) {}

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

    private function generateOrderNumber(): string
    {
        $now = now();
        $prefix = 'ORD-'.$now->format('ymd').'-';
        $count = Order::whereBetween('createdAt', [
            $now->copy()->startOfDay(),
            $now->copy()->endOfDay(),
        ])->count();

        return $prefix.str_pad((string) ($count + 1), 4, '0', STR_PAD_LEFT);
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
        $subtotal = 0;
        $orderItems = [];
        $stockUpdates = [];

        foreach ($data['items'] as $item) {
            $product = Product::with('variants.color', 'variants.size')->find($item['productId']);
            if (! $product) {
                throw new RuntimeException("Producto {$item['productId']} no encontrado", 404);
            }
            if (! $product->isActive) {
                throw new RuntimeException("El producto \"{$product->name}\" no está disponible");
            }

            $itemColor = strtolower((string) ($item['color'] ?? ''));
            $itemSize = (string) ($item['size'] ?? '');
            $variant = $product->variants->first(function ($v) use ($itemColor, $itemSize) {
                // Vacío/null se tratan igual (producto simple sin color/talla).
                $colorMatch = strtolower((string) $v->color?->hexCode) === $itemColor;
                $sizeMatch = (string) ($v->size?->name ?? '') === $itemSize
                    || (string) ($v->size?->abbreviation ?? '') === $itemSize;

                return $colorMatch && $sizeMatch;
            });

            if (! $variant) {
                throw new RuntimeException(
                    "No se encontró variante para \"{$product->name}\" con color {$item['color']} y talla {$item['size']}"
                );
            }

            if ($product->isTemplate) {
                $available = $this->templateStock->getAvailableStockForTemplate($variant->id);
                if ($available < $item['quantity']) {
                    throw new RuntimeException(
                        "Stock insuficiente para \"{$product->name}\" ({$item['size']}, {$item['color']}). Disponible: {$available}"
                    );
                }
            } elseif ($variant->stock < $item['quantity']) {
                throw new RuntimeException(
                    "Stock insuficiente para \"{$product->name}\" ({$item['size']}, {$item['color']}). Disponible: {$variant->stock}"
                );
            }

            $stockUpdates[] = [
                'variantId' => $variant->id,
                'quantity' => $item['quantity'],
                'isTemplate' => $product->isTemplate,
            ];

            $unitPrice = (float) $product->basePrice;
            $subtotal += $unitPrice * $item['quantity'];

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
                'customization' => $item['customization'] ?? null,
            ];
        }

        $shippingCost = $subtotal >= $settings['freeShippingThreshold'] ? 0 : $settings['shippingCost'];
        $tax = ($settings['taxEnabled'] && ! $settings['taxIncluded'])
            ? round($subtotal * $settings['taxRate'])
            : 0;
        $total = $subtotal + $shippingCost + $tax;
        $orderNumber = $this->generateOrderNumber();

        return DB::transaction(function () use (
            $userId, $data, $orderNumber, $subtotal, $shippingCost, $tax, $total, $orderItems, $stockUpdates
        ) {
            $order = Order::create([
                'orderNumber' => $orderNumber,
                'userId' => $userId,
                'subtotal' => $subtotal,
                'shippingCost' => $shippingCost,
                'discount' => 0,
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

            // Descontar stock de productos regulares (los templates se consumen al pagar).
            foreach ($stockUpdates as $su) {
                if ($su['isTemplate']) {
                    continue;
                }
                $variant = ProductVariant::find($su['variantId']);
                if (! $variant) {
                    continue;
                }
                $previousStock = $variant->stock;
                $variant->stock = $previousStock - $su['quantity'];
                $variant->save();

                VariantMovement::create([
                    'variantId' => $variant->id,
                    'movementType' => 'SALE',
                    'quantity' => -$su['quantity'],
                    'previousStock' => $previousStock,
                    'newStock' => $variant->stock,
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
        $limit = max(1, (int) ($query['limit'] ?? 10));

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
            }

            $order->save();
        });

        return $order->load(['items.product:id,images', 'user']);
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
            if (! $variant) {
                continue;
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
            $match = $this->matchingInputVariant($product->id, $variant);
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

            if ($product->isTemplate) {
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
                    $match = $this->matchingInputVariant($product->id, $variant);
                    if ($match) {
                        $this->moveInputStock(
                            $match->id, $item->quantity, 'DEVOLUCION', 'order_cancel', $order->id,
                            "Cancelación orden {$order->orderNumber} - Template {$product->name} (fallback)"
                        );
                    }
                }
            } else {
                $previousStock = $variant->stock;
                $variant->stock = $previousStock + $item->quantity;
                $variant->save();

                VariantMovement::create([
                    'variantId' => $variant->id,
                    'movementType' => 'RETURN',
                    'quantity' => $item->quantity,
                    'previousStock' => $previousStock,
                    'newStock' => $variant->stock,
                    'referenceType' => 'order_cancel',
                    'referenceId' => $order->id,
                    'reason' => "Cancelación orden {$order->orderNumber}",
                ]);
            }
        }
    }

    private function matchingInputVariant(int $productId, ProductVariant $variant): ?InputVariant
    {
        $productInputs = ProductInput::where('productId', $productId)
            ->with(['input.variants' => fn ($q) => $q->where('isActive', true)])
            ->get();
        $inputVariants = $productInputs->flatMap(fn ($pi) => $pi->input?->variants ?? []);

        return $inputVariants->first(function ($iv) use ($variant) {
            $colorMatch = $variant->colorId === null || $iv->colorId === $variant->colorId;
            $sizeMatch = $variant->sizeId === null || $iv->sizeId === $variant->sizeId;

            return $colorMatch && $sizeMatch;
        });
    }

    private function moveInputStock(int $inputVariantId, float $delta, string $type, string $refType, int $refId, string $reason): void
    {
        $inputVariant = InputVariant::find($inputVariantId);
        if (! $inputVariant) {
            return;
        }
        $previousStock = (float) $inputVariant->currentStock;
        $newStock = $previousStock + $delta;

        $inputVariant->currentStock = $newStock;
        $inputVariant->save();

        InputVariantMovement::create([
            'inputVariantId' => $inputVariantId,
            'movementType' => $type,
            'quantity' => $delta,
            'previousStock' => $previousStock,
            'newStock' => $newStock,
            'referenceType' => $refType,
            'referenceId' => $refId,
            'reason' => $reason,
        ]);
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
