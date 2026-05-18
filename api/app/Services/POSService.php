<?php

namespace App\Services;

use App\Models\CashSession;
use App\Models\InputVariant;
use App\Models\InputVariantMovement;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\POSCustomer;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\TemplateRecipe;
use App\Models\VariantMovement;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Lógica de ventas presenciales (POS): escaneo, búsqueda, cálculo, venta y
 * cancelación. Migrado de backend/src/services/pos.service.ts.
 */
class POSService
{
    public function __construct(private TemplateStockService $templateStock) {}

    /** Primera imagen de un producto, o null. */
    private function firstImage($images): ?string
    {
        if (is_array($images)) {
            return $images[0] ?? ($images['front'] ?? null);
        }

        return null;
    }

    /** Sesión de caja abierta del vendedor. */
    private function currentSession(int $sellerId): ?CashSession
    {
        return CashSession::where('sellerId', $sellerId)->where('status', 'OPEN')->first();
    }

    /** Genera un número de orden POS (POS-AAMMDD-NNNN). */
    private function generateOrderNumber(): string
    {
        return 'POS-'.date('ymd').'-'.str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
    }

    /** Escanea una variante por código de barras (POST /pos/scan). */
    public function scanProduct(string $barcode): ?array
    {
        $variant = ProductVariant::with(['product', 'color', 'size'])
            ->where('barcode', $barcode)->first();
        if (! $variant) {
            return null;
        }

        $stock = (int) $variant->stock;
        if ($variant->product->isTemplate) {
            $stock = $this->templateStock->getAvailableStockForTemplate($variant->id);
        }
        if ($stock <= 0) {
            throw new RuntimeException('Producto sin stock disponible');
        }

        $base = (float) $variant->product->basePrice;
        $price = $base + (float) ($variant->priceAdjustment ?? 0);

        return [
            'variantId' => $variant->id,
            'product' => [
                'id' => $variant->product->id,
                'name' => $variant->product->name,
                'image' => $this->firstImage($variant->product->images),
            ],
            'color' => $variant->color?->name ?? 'N/A',
            'size' => $variant->size?->abbreviation ?? $variant->size?->name ?? 'N/A',
            'sku' => $variant->sku,
            'barcode' => $variant->barcode,
            'price' => $price,
            'stock' => $stock,
            'available' => $stock > 0,
        ];
    }

    /** Da formato a un template con sus zonas para el POS. */
    private function formatTemplate(Product $t, ?array $scannedVariant = null): array
    {
        $result = [
            'type' => 'template',
            'productId' => $t->id,
            'templateId' => $t->id,
            'name' => $t->name,
            'image' => $this->firstImage($t->images),
            'sku' => $t->sku,
            'barcode' => $t->barcode,
            'basePrice' => (float) $t->basePrice,
            'zoneTypeImages' => $t->zoneTypeImages,
            'colors' => $t->productColors->map(fn ($pc) => [
                'id' => $pc->color->id,
                'name' => $pc->color->name,
                'slug' => $pc->color->slug,
                'hexCode' => $pc->color->hexCode,
            ])->all(),
            'sizes' => $t->productSizes->map(fn ($ps) => [
                'id' => $ps->size->id,
                'name' => $ps->size->name,
                'abbreviation' => $ps->size->abbreviation,
            ])->all(),
            'zones' => $t->templateZones->map(fn ($z) => [
                'id' => $z->id,
                'name' => $z->name,
                'price' => $z->price,
                'zoneType' => $z->zoneType?->name,
                'zoneTypeSlug' => $z->zoneType?->slug,
                'isRequired' => $z->isRequired,
                'isBlocked' => $z->isBlocked,
                'positionX' => $z->positionX,
                'positionY' => $z->positionY,
                'maxWidth' => $z->maxWidth,
                'maxHeight' => $z->maxHeight,
                'shape' => $z->shape,
            ])->all(),
        ];

        if ($scannedVariant !== null) {
            $result['scannedVariant'] = $scannedVariant;
        }

        return $result;
    }

    /** Carga un template con las relaciones necesarias para el POS. */
    private function loadTemplate(int $id): ?Product
    {
        return Product::with([
            'templateZones' => fn ($q) => $q->where('isActive', true)->with('zoneType'),
            'productColors.color',
            'productSizes.size',
        ])->find($id);
    }

    /** Busca productos y templates por código de barras o nombre (POST /pos/search). */
    public function search(string $query): array
    {
        $query = trim($query);
        if ($query === '') {
            return ['type' => 'list', 'results' => []];
        }

        // 1) Variante de producto por código de barras exacto.
        $variant = ProductVariant::with(['product', 'color', 'size'])
            ->where('barcode', $query)->first();

        if ($variant) {
            if ($variant->product->isTemplate) {
                $template = $this->loadTemplate($variant->product->id);
                if ($template) {
                    return [
                        'type' => 'single',
                        'result' => $this->formatTemplate($template, [
                            'variantId' => $variant->id,
                            'colorId' => $variant->colorId,
                            'colorName' => $variant->color?->name,
                            'colorHex' => $variant->color?->hexCode,
                            'sizeId' => $variant->sizeId,
                            'sizeName' => $variant->size?->name,
                            'sizeAbbr' => $variant->size?->abbreviation,
                        ]),
                    ];
                }
            }

            $base = (float) $variant->product->basePrice;

            return [
                'type' => 'single',
                'result' => [
                    'type' => 'product',
                    'variantId' => $variant->id,
                    'productId' => $variant->product->id,
                    'name' => $variant->product->name,
                    'image' => $this->firstImage($variant->product->images),
                    'color' => $variant->color?->name ?? 'N/A',
                    'size' => $variant->size?->abbreviation ?? $variant->size?->name ?? 'N/A',
                    'sku' => $variant->sku,
                    'barcode' => $variant->barcode,
                    'price' => $base + (float) ($variant->priceAdjustment ?? 0),
                    'stock' => (int) $variant->stock,
                    'available' => (int) $variant->stock > 0,
                ],
            ];
        }

        // 2) Template por código de barras exacto.
        $templateByBarcode = Product::where('barcode', $query)
            ->where('isActive', true)->where('isTemplate', true)->first();
        if ($templateByBarcode) {
            $template = $this->loadTemplate($templateByBarcode->id);
            if ($template) {
                return ['type' => 'single', 'result' => $this->formatTemplate($template)];
            }
        }

        // 3) Búsqueda por nombre/SKU.
        $results = [];

        $products = Product::with(['variants' => fn ($q) => $q->where('isActive', true)
            ->with('color', 'size')->limit(1)])
            ->where('isActive', true)->where('isTemplate', false)
            ->where(fn ($q) => $q->where('name', 'like', "%{$query}%")
                ->orWhere('sku', 'like', "%{$query}%"))
            ->limit(20)->get();

        foreach ($products as $product) {
            $v = $product->variants->first();
            if (! $v) {
                continue;
            }
            $finalPrice = (float) $product->basePrice + (float) ($v->priceAdjustment ?? 0);
            $results[] = [
                'type' => 'product',
                'variantId' => $v->id,
                'productId' => $product->id,
                'name' => $product->name,
                'image' => $this->firstImage($product->images),
                'color' => $v->color?->name ?? 'N/A',
                'size' => $v->size?->abbreviation ?? $v->size?->name ?? 'N/A',
                'sku' => $v->sku ?? $product->sku,
                'barcode' => $v->barcode,
                'price' => $finalPrice,
                'stock' => (int) $v->stock,
                'available' => (int) $v->stock > 0,
            ];
        }

        $templates = Product::with([
            'templateZones' => fn ($q) => $q->where('isActive', true)->with('zoneType'),
            'productColors.color',
            'productSizes.size',
        ])
            ->where('isActive', true)->where('isTemplate', true)
            ->where(fn ($q) => $q->where('name', 'like', "%{$query}%")
                ->orWhere('sku', 'like', "%{$query}%")
                ->orWhere('barcode', 'like', "%{$query}%"))
            ->limit(20)->get();

        foreach ($templates as $template) {
            $results[] = $this->formatTemplate($template);
        }

        return ['type' => 'list', 'results' => $results];
    }

    /** Calcula totales de una venta (POST /pos/calculate). */
    public function calculateSale(array $items, float $globalDiscount = 0): array
    {
        $subtotal = 0;
        $calculated = [];

        foreach ($items as $item) {
            $variant = ProductVariant::with(['product', 'color', 'size'])->find($item['variantId']);
            if (! $variant) {
                throw new RuntimeException("Variante {$item['variantId']} no encontrada");
            }

            $unitPrice = (float) $item['price'];
            $itemDiscount = (float) ($item['discount'] ?? 0);
            $itemSubtotal = $unitPrice * $item['quantity'] - $itemDiscount;
            $subtotal += $itemSubtotal;

            $calculated[] = [
                'variantId' => $variant->id,
                'productName' => $variant->product->name,
                'color' => $variant->color?->name ?? 'N/A',
                'size' => $variant->size?->abbreviation ?? $variant->size?->name ?? 'N/A',
                'quantity' => $item['quantity'],
                'unitPrice' => $unitPrice,
                'discount' => $itemDiscount,
                'subtotal' => $itemSubtotal,
            ];
        }

        $tax = 0;

        return [
            'subtotal' => $subtotal,
            'discount' => $globalDiscount,
            'tax' => $tax,
            'total' => $subtotal - $globalDiscount + $tax,
            'items' => $calculated,
        ];
    }

    /** Crea o actualiza el cliente POS por cédula; devuelve su id o null. */
    private function upsertPOSCustomer(?string $cedula, ?string $name, ?string $email, ?string $phone, float $orderTotal): ?int
    {
        $cedula = $cedula ? trim($cedula) : '';
        if ($cedula === '') {
            return null;
        }

        $customer = POSCustomer::where('cedula', $cedula)->first();
        if ($customer) {
            $customer->totalPurchases = (int) $customer->totalPurchases + 1;
            $customer->totalSpent = (float) $customer->totalSpent + $orderTotal;
            if ($name && trim($name) && (! $customer->name || $customer->name === 'Cliente POS')) {
                $customer->name = trim($name);
            }
            if ($phone && trim($phone) && ! $customer->phone) {
                $customer->phone = trim($phone);
            }
            if ($email && trim($email) && ! $customer->email) {
                $customer->email = trim($email);
            }
            $customer->save();

            return $customer->id;
        }

        return POSCustomer::create([
            'cedula' => $cedula,
            'name' => $name ? trim($name) : 'Cliente POS',
            'email' => $email ? trim($email) : null,
            'phone' => $phone ? trim($phone) : null,
            'totalPurchases' => 1,
            'totalSpent' => $orderTotal,
        ])->id;
    }

    /** Crea una venta POS (POST /pos/sale). */
    public function createSale(array $data): Order
    {
        $session = $this->currentSession($data['sellerId']);
        if (! $session) {
            throw new RuntimeException('No tienes una sesión de caja abierta');
        }
        if ($session->cashRegisterId !== $data['cashRegisterId']) {
            throw new RuntimeException('La sesión abierta no corresponde a esta caja');
        }

        $calculation = $this->calculateSale($data['items'], (float) ($data['discount'] ?? 0));

        if ($data['paymentMethod'] === 'mixed') {
            $totalPaid = (float) ($data['cashAmount'] ?? 0) + (float) ($data['cardAmount'] ?? 0);
            if (abs($totalPaid - $calculation['total']) > 0.01) {
                throw new RuntimeException('El monto total pagado no coincide con el total de la venta');
            }
        }

        // Verificar stock de todos los items.
        foreach ($data['items'] as $item) {
            $variant = ProductVariant::with('product')->find($item['variantId']);
            if (! $variant) {
                throw new RuntimeException("Variante {$item['variantId']} no encontrada");
            }
            $available = (int) $variant->stock;
            if ($variant->product->isTemplate) {
                $available = $this->templateStock->getAvailableStockForTemplate($variant->id);
            }
            if ($available < $item['quantity']) {
                throw new RuntimeException("Stock insuficiente para {$variant->sku}. Disponible: {$available}, Solicitado: {$item['quantity']}");
            }
        }

        return DB::transaction(function () use ($data, $calculation, $session) {
            $posCustomerId = null;
            if (! empty($data['customerCedula'])) {
                $posCustomerId = $this->upsertPOSCustomer(
                    $data['customerCedula'],
                    $data['customerName'] ?? null,
                    $data['customerEmail'] ?? null,
                    $data['customerPhone'] ?? null,
                    $calculation['total'],
                );
            }

            $order = Order::create([
                'orderNumber' => $this->generateOrderNumber(),
                'posCustomerId' => $posCustomerId,
                'customerEmail' => $data['customerEmail'] ?? 'venta-pos@local.com',
                'customerName' => $data['customerName'] ?? 'Cliente POS',
                'customerPhone' => $data['customerPhone'] ?? null,
                'subtotal' => $calculation['subtotal'],
                'discount' => $calculation['discount'],
                'tax' => $calculation['tax'],
                'total' => $calculation['total'],
                'status' => 'PAID',
                'paymentMethod' => $data['paymentMethod'],
                'paymentRef' => $data['cardReference'] ?? ('POS-'.(int) (microtime(true) * 1000)),
                'cashAmount' => $data['cashAmount'] ?? null,
                'cardAmount' => $data['cardAmount'] ?? null,
                'cardReference' => $data['cardReference'] ?? null,
                'cardType' => $data['cardType'] ?? null,
                'cardLastFour' => $data['cardLastFour'] ?? null,
                'saleChannel' => 'POS',
                'sellerId' => $data['sellerId'],
                'cashRegisterId' => $data['cashRegisterId'],
                'statusHistory' => [[
                    'status' => 'PAID',
                    'timestamp' => now()->toIso8601String(),
                    'note' => 'Venta POS - '.$data['paymentMethod']
                        .(! empty($data['cardReference']) ? ' - Ref: '.$data['cardReference'] : ''),
                ]],
                'paidAt' => now(),
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($data['items'] as $item) {
                $variant = ProductVariant::with(['product', 'color', 'size'])->find($item['variantId']);

                OrderItem::create([
                    'orderId' => $order->id,
                    'productId' => $variant->productId,
                    'variantId' => $variant->id,
                    'productName' => $variant->product->name,
                    'productImage' => (string) ($this->firstImage($variant->product->images) ?? ''),
                    'size' => $variant->size?->abbreviation ?? $variant->size?->name ?? 'N/A',
                    'color' => $variant->color?->name ?? 'N/A',
                    'quantity' => $item['quantity'],
                    'unitPrice' => $item['price'],
                ]);

                if ($variant->product->isTemplate) {
                    $recipes = TemplateRecipe::where('variantId', $variant->id)->get();
                    foreach ($recipes as $recipe) {
                        $consume = (float) $recipe->quantity * $item['quantity'];
                        $iv = InputVariant::find($recipe->inputVariantId);
                        if (! $iv) {
                            continue;
                        }
                        $prev = (float) $iv->currentStock;
                        $iv->currentStock = $prev - $consume;
                        $iv->save();

                        InputVariantMovement::create([
                            'inputVariantId' => $recipe->inputVariantId,
                            'movementType' => 'SALIDA',
                            'quantity' => -$consume,
                            'previousStock' => $prev,
                            'newStock' => $prev - $consume,
                            'referenceType' => 'sale',
                            'referenceId' => $order->id,
                            'reason' => 'Venta POS - Template '.$variant->product->name,
                        ]);
                    }
                } else {
                    $prev = (int) $variant->stock;
                    $variant->stock = $prev - $item['quantity'];
                    $variant->save();

                    VariantMovement::create([
                        'variantId' => $variant->id,
                        'movementType' => 'SALE',
                        'quantity' => -$item['quantity'],
                        'previousStock' => $prev,
                        'newStock' => $prev - $item['quantity'],
                        'referenceType' => 'sale',
                        'referenceId' => $order->id,
                        'reason' => 'Venta POS',
                    ]);
                }
            }

            $session->salesCount = (int) $session->salesCount + 1;
            $session->totalSales = (float) $session->totalSales + $calculation['total'];
            $session->save();

            return $order;
        });
    }

    /** Cancela una venta POS y restaura el stock (POST /pos/sale/{id}/cancel). */
    public function cancelSale(int $orderId, int $sellerId, string $reason): Order
    {
        $order = Order::with('items')->find($orderId);
        if (! $order) {
            throw new RuntimeException('Venta no encontrada');
        }
        if ($order->saleChannel !== 'POS') {
            throw new RuntimeException('Solo se pueden cancelar ventas POS desde este módulo');
        }
        if ($order->sellerId !== $sellerId) {
            throw new RuntimeException('Solo puedes cancelar tus propias ventas');
        }
        if ($order->status === 'CANCELLED') {
            throw new RuntimeException('La venta ya está cancelada');
        }

        return DB::transaction(function () use ($order, $reason) {
            $order->status = 'CANCELLED';
            $order->notes = $order->notes
                ? $order->notes."\nCANCELADO: ".$reason
                : 'CANCELADO: '.$reason;
            $order->save();

            foreach ($order->items as $item) {
                if ($item->variantId) {
                    ProductVariant::where('id', $item->variantId)->increment('stock', $item->quantity);
                }
            }

            if ($order->cashRegisterId && $order->sellerId) {
                $session = CashSession::where('cashRegisterId', $order->cashRegisterId)
                    ->where('sellerId', $order->sellerId)
                    ->where('status', 'OPEN')->first();
                if ($session) {
                    $session->salesCount = max(0, (int) $session->salesCount - 1);
                    $session->totalSales = (float) $session->totalSales - (float) $order->total;
                    $session->save();
                }
            }

            return $order;
        });
    }

    /** Historial de ventas POS del vendedor (GET /pos/sales). */
    public function salesHistory(array $filter)
    {
        $query = Order::with([
            'items',
            'posCustomer:id,cedula,name,email,phone,totalPurchases,totalSpent',
            'seller:id,name,email',
        ])->where('saleChannel', 'POS');

        if (! empty($filter['sellerId'])) {
            $query->where('sellerId', $filter['sellerId']);
        }
        if (! empty($filter['cashRegisterId'])) {
            $query->where('cashRegisterId', $filter['cashRegisterId']);
        }
        if (! empty($filter['status'])) {
            $query->where('status', $filter['status']);
        }
        if (! empty($filter['dateFrom'])) {
            $query->where('createdAt', '>=', $filter['dateFrom']);
        }
        if (! empty($filter['dateTo'])) {
            $query->where('createdAt', '<=', $filter['dateTo']);
        }

        return $query->orderByDesc('createdAt')->get()->map(function ($order) {
            $arr = $order->toArray();
            $arr['paymentEvidence'] = $order->paymentEvidence ? 'exists' : null;

            return $arr;
        });
    }

    /** Detalle de una venta POS (GET /pos/sale/{id}). */
    public function saleById(int $id): ?Order
    {
        $order = Order::with([
            'items.variant.product',
            'items.variant.color',
            'items.variant.size',
            'posCustomer:id,cedula,name,email,phone,totalPurchases,totalSpent',
            'seller:id,name,email',
            'cashRegister',
        ])->find($id);

        if (! $order || $order->saleChannel !== 'POS') {
            return null;
        }

        return $order;
    }

    /** Busca un cliente POS por cédula (GET /pos/customer/search). */
    public function customerByCedula(string $cedula): ?POSCustomer
    {
        return POSCustomer::where('cedula', trim($cedula))->first();
    }

    /** Carga una orden POS para facturación (PDF/email). */
    public function saleForInvoice(int $orderId): Order
    {
        $order = Order::with([
            'items.variant.product',
            'items.variant.color',
            'items.variant.size',
            'user:id,name,email',
            'seller:id,name',
        ])->find($orderId);

        if (! $order) {
            throw new RuntimeException('Venta no encontrada');
        }
        if ($order->saleChannel !== 'POS') {
            throw new RuntimeException('Solo se pueden generar facturas de ventas POS');
        }

        return $order;
    }

    /** Sube la evidencia de pago de una transferencia (POST /pos/sale/{id}/payment-evidence). */
    public function uploadPaymentEvidence(int $orderId, string $evidence, int $userId): array
    {
        $order = Order::find($orderId);
        if (! $order) {
            throw new RuntimeException('Venta no encontrada');
        }
        if ($order->saleChannel !== 'POS') {
            throw new RuntimeException('Solo se pueden subir evidencias de ventas POS');
        }
        if ($order->paymentMethod !== 'transfer') {
            throw new RuntimeException('Solo se pueden subir evidencias para pagos por transferencia');
        }
        if ($order->sellerId !== $userId) {
            throw new RuntimeException('No tienes permiso para modificar esta venta');
        }

        $order->paymentEvidence = $evidence;
        $order->save();

        return [
            'id' => $order->id,
            'orderNumber' => $order->orderNumber,
            'paymentEvidence' => 'uploaded',
        ];
    }

    /** Devuelve la evidencia de pago (GET /pos/sale/{id}/payment-evidence). */
    public function paymentEvidence(int $orderId): ?string
    {
        return Order::where('id', $orderId)->value('paymentEvidence');
    }
}
