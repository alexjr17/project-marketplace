<?php

namespace App\Services;

use App\Models\CashRegister;
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
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Lógica de ventas presenciales (POS): escaneo, búsqueda, cálculo, venta y
 * cancelación. Migrado de backend/src/services/pos.service.ts.
 */
class POSService
{
    public function __construct(
        private TemplateStockService $templateStock,
        private DiscountService $discounts,
    ) {}

    /** Ofertas automáticas vigentes para el POS, cacheadas por request. */
    private ?Collection $posAutos = null;

    private function posAutoDiscounts(): Collection
    {
        return $this->posAutos ??= $this->discounts->activeAutoDiscounts('pos');
    }

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

    /**
     * Categorías que la caja de la sesión activa puede vender.
     * Devuelve null si no hay sesión, no hay caja, o la caja no tiene categorías
     * asignadas (en cuyo caso puede vender TODOS los productos).
     */
    private function sessionCategoryIds(?int $sellerId): ?array
    {
        if (! $sellerId) {
            return null;
        }
        $session = $this->currentSession($sellerId);
        if (! $session) {
            return null;
        }
        $caja = CashRegister::find($session->cashRegisterId);
        $ids = $caja?->categoryIds;

        return (is_array($ids) && count($ids) > 0) ? $ids : null;
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

    /** Da formato a un producto normal (usa su primera variante). */
    private function formatProductResult(Product $product): ?array
    {
        $v = $product->variants->first();
        if (! $v) {
            return null;
        }
        $base = (float) $product->basePrice + (float) ($v->priceAdjustment ?? 0);
        // Aplica la oferta automática vigente (canal POS), si corresponde.
        $best = $this->discounts->bestAutoFor($product, $this->posAutoDiscounts());
        $amount = $best ? $best['amount'] : 0.0;
        $finalPrice = max(0.0, $base - $amount);

        // Stock total (suma de las variantes activas), no solo la representativa.
        $totalStock = (int) $product->variants()->where('isActive', true)->sum('stock');

        // Imagen por color de la variante (si existe); si no, la del producto.
        $image = $this->firstImage($product->images);
        if ($v->colorId) {
            $pc = \App\Models\ProductColor::where('productId', $product->id)->where('colorId', $v->colorId)->first();
            $colorImg = $pc ? \App\Support\ImageUrls::forColor($pc->image, $pc->id, $product->updatedAt) : null;
            if ($colorImg) {
                $image = $colorImg;
            }
        }

        return [
            'type' => 'product',
            'variantId' => $v->id,
            'productId' => $product->id,
            'name' => $product->name,
            'image' => $image,
            'color' => $v->color?->name ?? 'N/A',
            'size' => $v->size?->abbreviation ?? $v->size?->name ?? 'N/A',
            'sku' => $v->sku ?? $product->sku,
            'barcode' => $v->barcode,
            'price' => $finalPrice,
            'basePrice' => $base,
            'hasDiscount' => $amount > 0,
            // Stock total del producto (suma de todas sus variantes activas).
            'stock' => $totalStock,
            'available' => $totalStock > 0,
            // Si el producto tiene colores/tallas, hay que elegir variante.
            'hasOptions' => $product->productColors->isNotEmpty() || $product->productSizes->isNotEmpty(),
        ];
    }

    /** Variantes activas de un producto, para elegir color/talla en el POS. */
    public function productVariants(int $productId): array
    {
        $product = Product::with(['variants' => fn ($q) => $q->where('isActive', true)->with('color', 'size')])
            ->find($productId);
        if (! $product) {
            return [];
        }

        $best = $this->discounts->bestAutoFor($product, $this->posAutoDiscounts());
        $amount = $best ? $best['amount'] : 0.0;

        return $product->variants->map(function ($v) use ($product, $amount) {
            $base = (float) $product->basePrice + (float) ($v->priceAdjustment ?? 0);
            $image = $this->firstImage($product->images);
            if ($v->colorId) {
                $pc = \App\Models\ProductColor::where('productId', $product->id)->where('colorId', $v->colorId)->first();
                $colorImg = $pc ? \App\Support\ImageUrls::forColor($pc->image, $pc->id, $product->updatedAt) : null;
                if ($colorImg) {
                    $image = $colorImg;
                }
            }

            return [
                'variantId' => $v->id,
                'productId' => $product->id,
                'name' => $product->name,
                'colorName' => $v->color?->name,
                'colorHex' => $v->color?->hexCode,
                'size' => $v->size?->abbreviation ?? $v->size?->name,
                'sizeName' => $v->size?->name,
                'sku' => $v->sku ?? $product->sku,
                'barcode' => $v->barcode,
                'image' => $image,
                'price' => max(0.0, $base - $amount),
                'basePrice' => $base,
                'hasDiscount' => $amount > 0,
                'stock' => (int) $v->stock,
                'available' => (int) $v->stock > 0,
            ];
        })->values()->all();
    }

    /** Lista paginada de productos y templates para el POS (GET /pos/products). */
    public function browseProducts(int $page, int $perPage, ?string $search = null, ?int $sellerId = null, ?int $categoryId = null, ?string $type = null): array
    {
        $query = Product::with([
            'variants' => fn ($q) => $q->where('isActive', true)->with('color', 'size')->limit(1),
            'templateZones' => fn ($q) => $q->where('isActive', true)->with('zoneType'),
            'productColors.color',
            'productSizes.size',
        ])->where('isActive', true);

        // Filtro por tipo: 'product' (catálogo) o 'template' (plantillas).
        if ($type === 'product') {
            $query->where('isTemplate', false);
        } elseif ($type === 'template') {
            $query->where('isTemplate', true);
        }

        // Si la caja de la sesión tiene categorías asignadas, solo esos productos.
        $catIds = $this->sessionCategoryIds($sellerId);
        if ($catIds) {
            $query->whereIn('categoryId', $catIds);
        }

        // Filtro por categoría puntual (chips del POS).
        if ($categoryId) {
            $query->where('categoryId', $categoryId);
        }

        if ($search !== null && trim($search) !== '') {
            // Insensible a mayúsculas (en Postgres LIKE distingue).
            $term = '%'.mb_strtolower(trim($search)).'%';
            $query->where(fn ($q) => $q->whereRaw('LOWER(name) LIKE ?', [$term])
                ->orWhereRaw('LOWER(sku) LIKE ?', [$term])
                ->orWhereRaw('LOWER(barcode) LIKE ?', [$term])
                ->orWhereHas('variants', fn ($v) => $v->whereRaw('LOWER(barcode) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(sku) LIKE ?', [$term])));
        }

        $total = (clone $query)->count();
        $products = $query->orderBy('name')
            ->skip(($page - 1) * $perPage)->take($perPage)->get();

        $results = [];
        foreach ($products as $product) {
            if ($product->isTemplate) {
                $results[] = $this->formatTemplate($product);
            } else {
                $row = $this->formatProductResult($product);
                if ($row) {
                    $results[] = $row;
                }
            }
        }

        return [
            'results' => $results,
            'page' => $page,
            'perPage' => $perPage,
            'total' => $total,
            'totalPages' => (int) ceil($total / max(1, $perPage)),
        ];
    }

    /** Busca productos y templates por código de barras o nombre (POST /pos/search). */
    public function search(string $query, ?int $sellerId = null): array
    {
        $query = trim($query);
        if ($query === '') {
            return ['type' => 'list', 'results' => []];
        }

        // Categorías que la caja de la sesión puede vender (null = todas).
        $catIds = $this->sessionCategoryIds($sellerId);
        $inCaja = fn (?int $categoryId) => ! $catIds || in_array($categoryId, $catIds, true);

        // 1) Variante de producto por código de barras exacto.
        $variant = ProductVariant::with(['product', 'color', 'size'])
            ->where('barcode', $query)->first();

        if ($variant && $inCaja($variant->product->categoryId)) {
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
        if ($templateByBarcode && $inCaja($templateByBarcode->categoryId)) {
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
            ->when($catIds, fn ($q) => $q->whereIn('categoryId', $catIds))
            ->where(fn ($q) => $q->where('name', 'like', "%{$query}%")
                ->orWhere('sku', 'like', "%{$query}%"))
            ->limit(20)->get();

        foreach ($products as $product) {
            $row = $this->formatProductResult($product);
            if ($row) {
                $results[] = $row;
            }
        }

        $templates = Product::with([
            'templateZones' => fn ($q) => $q->where('isActive', true)->with('zoneType'),
            'productColors.color',
            'productSizes.size',
        ])
            ->where('isActive', true)->where('isTemplate', true)
            ->when($catIds, fn ($q) => $q->whereIn('categoryId', $catIds))
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
            $isDebt = ($data['paymentMethod'] === 'debe');

            // Resolver cliente: por id seleccionado, por cédula (upsert) o por nombre.
            $posCustomerId = null;
            if (! empty($data['customerId'])) {
                $posCustomerId = (int) $data['customerId'];
            } elseif (! empty($data['customerCedula'])) {
                $posCustomerId = $this->upsertPOSCustomer(
                    $data['customerCedula'],
                    $data['customerName'] ?? null,
                    $data['customerEmail'] ?? null,
                    $data['customerPhone'] ?? null,
                    $calculation['total'],
                );
            } elseif (! empty($data['customerName'])) {
                // Cliente nuevo por nombre: se registra al finalizar la venta.
                $posCustomerId = $this->findOrCreateCustomerByName($data['customerName'])->id;
            }

            // Un fiado ("debe") exige cliente identificado para poder cobrarlo después.
            if ($isDebt && ! $posCustomerId) {
                throw new RuntimeException('Para una venta a crédito (Debe) debes seleccionar o registrar un cliente.');
            }

            // ¿Queda como deuda? Solo si es "debe" y el abono no cubre el total.
            $abonoPaid = (float) ($data['cashAmount'] ?? 0) + (float) ($data['cardAmount'] ?? 0);
            $leavesDebt = $isDebt && ($abonoPaid + 0.01 < $calculation['total']);

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
                'status' => $leavesDebt ? 'PENDING' : 'PAID',
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
                    'status' => $leavesDebt ? 'PENDING' : 'PAID',
                    'timestamp' => now()->toIso8601String(),
                    'note' => $leavesDebt
                        ? 'Venta POS a crédito (Debe) - pendiente de cobro'
                        : 'Venta POS - '.$data['paymentMethod']
                            .(! empty($data['cardReference']) ? ' - Ref: '.$data['cardReference'] : ''),
                ]],
                'paidAt' => $leavesDebt ? null : now(),
                'notes' => $data['notes'] ?? null,
                'editHistory' => [[
                    'action' => 'created',
                    'timestamp' => now()->toIso8601String(),
                    'userId' => $data['sellerId'] ?? null,
                    'changes' => [],
                    'snapshot' => [
                        'total' => $calculation['total'],
                        'discount' => $calculation['discount'],
                        'paymentMethod' => $data['paymentMethod'],
                        'cashAmount' => (float) ($data['cashAmount'] ?? 0),
                        'cardAmount' => (float) ($data['cardAmount'] ?? 0),
                    ],
                ]],
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
    public function cancelSale(int $orderId, int $sellerId, string $reason, bool $isAdmin = false): Order
    {
        $order = Order::with('items')->find($orderId);
        if (! $order) {
            throw new RuntimeException('Venta no encontrada');
        }
        if ($order->saleChannel !== 'POS') {
            throw new RuntimeException('Solo se pueden anular ventas POS desde este módulo');
        }
        if (! $isAdmin && $order->sellerId !== $sellerId) {
            throw new RuntimeException('Solo puedes anular tus propias ventas');
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

    /**
     * Devolución parcial de una venta POS (POST /pos/sale/{id}/return).
     * Reintegra el stock de los ítems devueltos, recalcula los totales, ajusta
     * la caja por el reembolso y deja registro en el historial de cambios.
     */
    public function returnSaleItems(int $orderId, array $items, string $reason, string $refundMethod, int $userId, bool $isAdmin = false): Order
    {
        $order = Order::with('items')->find($orderId);
        if (! $order || $order->saleChannel !== 'POS') {
            throw new RuntimeException('Venta no encontrada');
        }
        if ($order->status === 'CANCELLED') {
            throw new RuntimeException('No se puede devolver una venta anulada');
        }
        if (! $isAdmin && $order->sellerId !== $userId) {
            throw new RuntimeException('Solo puedes registrar devoluciones de tus propias ventas');
        }

        // Cantidades vendidas por variante.
        $sold = [];
        foreach ($order->items as $it) {
            if ($it->variantId) {
                $sold[$it->variantId] = ($sold[$it->variantId] ?? 0) + (int) $it->quantity;
            }
        }
        // Validar y consolidar lo que se devuelve.
        $ret = [];
        foreach ($items as $r) {
            $vid = (int) ($r['variantId'] ?? 0);
            $qty = (int) ($r['quantity'] ?? 0);
            if ($qty <= 0) {
                continue;
            }
            if (! isset($sold[$vid])) {
                throw new RuntimeException('Un producto no pertenece a esta venta');
            }
            $ret[$vid] = ($ret[$vid] ?? 0) + $qty;
            if ($ret[$vid] > $sold[$vid]) {
                throw new RuntimeException('La cantidad a devolver supera lo vendido');
            }
        }
        if (empty($ret)) {
            throw new RuntimeException('No hay ítems para devolver');
        }

        return DB::transaction(function () use ($order, $ret, $reason, $refundMethod, $userId) {
            $oldTotal = (float) $order->total;
            $returnedDetail = [];

            foreach ($order->items as $item) {
                $vid = $item->variantId;
                if (! $vid || ! isset($ret[$vid])) {
                    continue;
                }
                $qty = $ret[$vid];

                // Reintegrar stock + movimiento.
                $v = ProductVariant::find($vid);
                if ($v) {
                    $prev = (int) $v->stock;
                    $v->stock = $prev + $qty;
                    $v->save();
                    VariantMovement::create([
                        'variantId' => $vid,
                        'movementType' => 'RETURN',
                        'quantity' => $qty,
                        'previousStock' => $prev,
                        'newStock' => $prev + $qty,
                        'referenceType' => 'return',
                        'referenceId' => $order->id,
                        'reason' => 'Devolución POS'.($reason ? ': '.$reason : ''),
                    ]);
                }
                $returnedDetail[] = $item->productName.' x'.$qty;

                // Reducir o eliminar el ítem de la orden.
                $newQty = (int) $item->quantity - $qty;
                if ($newQty <= 0) {
                    $item->delete();
                } else {
                    $item->quantity = $newQty;
                    $item->save();
                }
            }

            // Recalcular totales con los ítems restantes.
            $remaining = OrderItem::where('orderId', $order->id)->get();
            if ($remaining->isEmpty()) {
                $order->subtotal = 0;
                $order->discount = 0;
                $order->tax = 0;
                $order->total = 0;
                $order->status = 'CANCELLED';
            } else {
                $calcItems = $remaining->map(fn ($i) => [
                    'variantId' => $i->variantId,
                    'quantity' => (int) $i->quantity,
                    'price' => (float) $i->unitPrice,
                ])->all();
                $newSubtotal = array_sum(array_map(fn ($i) => $i['price'] * $i['quantity'], $calcItems));
                $disc = min((float) $order->discount, $newSubtotal);
                $calc = $this->calculateSale($calcItems, $disc);
                $order->subtotal = $calc['subtotal'];
                $order->discount = $calc['discount'];
                $order->tax = $calc['tax'];
                $order->total = $calc['total'];
            }

            $refund = max(0, $oldTotal - (float) $order->total);

            // Recalcular estado (para fiados) sin tocar lo ya pagado.
            if ($order->status !== 'CANCELLED') {
                $paid = (float) ($order->cashAmount ?? 0) + (float) ($order->cardAmount ?? 0);
                $order->status = ($order->paymentMethod === 'debe')
                    ? (($paid + 0.01 >= (float) $order->total) ? 'PAID' : 'PENDING')
                    : 'PAID';
            }

            $order->notes = $order->notes
                ? $order->notes."\nDEVOLUCIÓN: ".implode(', ', $returnedDetail).($reason ? ' ('.$reason.')' : '')
                : 'DEVOLUCIÓN: '.implode(', ', $returnedDetail).($reason ? ' ('.$reason.')' : '');

            $statusHistory = $order->statusHistory ?? [];
            $statusHistory[] = [
                'status' => $order->status,
                'timestamp' => now()->toIso8601String(),
                'note' => 'Devolución - reembolso $'.number_format($refund, 0, ',', '.'),
            ];
            $order->statusHistory = $statusHistory;

            $editHistory = $order->editHistory ?? [];
            $editHistory[] = [
                'action' => 'return',
                'timestamp' => now()->toIso8601String(),
                'userId' => $userId,
                'changes' => [[
                    'field' => 'return',
                    'label' => 'Devolución',
                    'from' => implode(', ', $returnedDetail),
                    'to' => 'Reembolso $'.number_format($refund, 0, ',', '.')
                        .' ('.($refundMethod === 'cash' ? 'Efectivo' : 'Transferencia').')'
                        .($reason ? ' · '.$reason : ''),
                ]],
            ];
            $order->editHistory = $editHistory;

            $order->save();

            // Ajustar la caja abierta por el reembolso.
            if ($order->cashRegisterId) {
                $session = CashSession::where('cashRegisterId', $order->cashRegisterId)
                    ->where('status', 'OPEN')->first();
                if ($session) {
                    $session->totalSales = (float) $session->totalSales - $refund;
                    if ($remaining->isEmpty()) {
                        $session->salesCount = max(0, (int) $session->salesCount - 1);
                    }
                    $session->save();
                }
            }

            return $order->fresh(['items']);
        });
    }

    /**
     * Edita una venta POS (PUT /pos/sale/{id}): ítems (recalcula stock y
     * totales), cliente, método de pago y notas.
     */
    public function updateSale(int $orderId, array $data, int $userId, bool $isAdmin = false): Order
    {
        $order = Order::with('items')->find($orderId);
        if (! $order || $order->saleChannel !== 'POS') {
            throw new RuntimeException('Venta no encontrada');
        }
        if ($order->status === 'CANCELLED') {
            throw new RuntimeException('No se puede editar una venta anulada');
        }
        if (! $isAdmin && $order->sellerId !== $userId) {
            throw new RuntimeException('Solo puedes editar tus propias ventas');
        }

        $editItems = isset($data['items']) && is_array($data['items']) && count($data['items']) > 0;

        // Validar stock para los ítems nuevos (sumando lo que esta venta ya tenía).
        if ($editItems) {
            $current = [];
            foreach ($order->items as $old) {
                if ($old->variantId) {
                    $current[$old->variantId] = ($current[$old->variantId] ?? 0) + $old->quantity;
                }
            }
            foreach ($data['items'] as $it) {
                $v = ProductVariant::find($it['variantId']);
                if (! $v) {
                    throw new RuntimeException("Variante {$it['variantId']} no encontrada");
                }
                $available = (int) $v->stock + ($current[$v->id] ?? 0);
                if ($available < $it['quantity']) {
                    throw new RuntimeException("Stock insuficiente para {$v->sku}. Disponible: {$available}");
                }
            }
        }

        return DB::transaction(function () use ($order, $data, $editItems, $userId) {
            $oldTotal = (float) $order->total;
            // Snapshot ANTES de aplicar cambios (para el historial de ediciones).
            $before = [
                'subtotal' => (float) $order->subtotal,
                'discount' => (float) $order->discount,
                'total' => (float) $order->total,
                'paymentMethod' => (string) $order->paymentMethod,
                'cashAmount' => (float) ($order->cashAmount ?? 0),
                'cardAmount' => (float) ($order->cardAmount ?? 0),
                'cardReference' => (string) ($order->cardReference ?? ''),
                'cardType' => (string) ($order->cardType ?? ''),
                'cardLastFour' => (string) ($order->cardLastFour ?? ''),
                'customerName' => (string) ($order->customerName ?? ''),
                'notes' => (string) ($order->notes ?? ''),
                'itemsCount' => (int) $order->items->sum('quantity'),
            ];

            if ($editItems) {
                // Restituir stock de los ítems actuales y reemplazarlos.
                foreach ($order->items as $old) {
                    if ($old->variantId) {
                        ProductVariant::where('id', $old->variantId)->increment('stock', $old->quantity);
                    }
                }
                OrderItem::where('orderId', $order->id)->delete();

                $calc = $this->calculateSale($data['items'], (float) ($data['discount'] ?? $order->discount ?? 0));

                foreach ($data['items'] as $it) {
                    $v = ProductVariant::with(['product', 'color', 'size'])->find($it['variantId']);
                    OrderItem::create([
                        'orderId' => $order->id,
                        'productId' => $v->productId,
                        'variantId' => $v->id,
                        'productName' => $v->product->name,
                        'productImage' => (string) ($this->firstImage($v->product->images) ?? ''),
                        'size' => $v->size?->abbreviation ?? $v->size?->name ?? 'N/A',
                        'color' => $v->color?->name ?? 'N/A',
                        'quantity' => $it['quantity'],
                        'unitPrice' => $it['price'],
                    ]);
                    $prev = (int) $v->stock;
                    $v->stock = $prev - $it['quantity'];
                    $v->save();
                    VariantMovement::create([
                        'variantId' => $v->id,
                        'movementType' => 'SALE',
                        'quantity' => -$it['quantity'],
                        'previousStock' => $prev,
                        'newStock' => $prev - $it['quantity'],
                        'referenceType' => 'sale',
                        'referenceId' => $order->id,
                        'reason' => 'Edición de venta POS',
                    ]);
                }

                $order->subtotal = $calc['subtotal'];
                $order->discount = $calc['discount'];
                $order->tax = $calc['tax'];
                $order->total = $calc['total'];
            }

            // Cliente (por id, cédula o nombre).
            if (! empty($data['customerId'])) {
                $order->posCustomerId = (int) $data['customerId'];
            } elseif (! empty($data['customerCedula'])) {
                $order->posCustomerId = $this->upsertPOSCustomer(
                    $data['customerCedula'], $data['customerName'] ?? null,
                    $data['customerEmail'] ?? null, $data['customerPhone'] ?? null, (float) $order->total
                );
            } elseif (! empty($data['customerName'])) {
                $order->posCustomerId = $this->findOrCreateCustomerByName($data['customerName'])->id;
            }
            if (array_key_exists('customerName', $data) && $data['customerName']) {
                $order->customerName = $data['customerName'];
            }
            if (array_key_exists('customerPhone', $data)) {
                $order->customerPhone = $data['customerPhone'];
            }
            if (! empty($data['customerEmail'])) {
                $order->customerEmail = $data['customerEmail'];
            }
            if (array_key_exists('paymentMethod', $data) && $data['paymentMethod']) {
                $order->paymentMethod = $data['paymentMethod'];
            }
            if (array_key_exists('notes', $data)) {
                $order->notes = $data['notes'];
            }

            // Datos de pago / transacción (referencia, tipo, montos).
            if (array_key_exists('cashAmount', $data) && $data['cashAmount'] !== null) {
                $order->cashAmount = (float) $data['cashAmount'];
            }
            if (array_key_exists('cardAmount', $data) && $data['cardAmount'] !== null) {
                $order->cardAmount = (float) $data['cardAmount'];
            }
            if (array_key_exists('cardReference', $data)) {
                $order->cardReference = $data['cardReference'];
            }
            if (array_key_exists('cardType', $data)) {
                $order->cardType = $data['cardType'];
            }
            if (array_key_exists('cardLastFour', $data)) {
                $order->cardLastFour = $data['cardLastFour'];
            }

            // Estado según pago / abono acumulado.
            $paid = (float) ($order->cashAmount ?? 0) + (float) ($order->cardAmount ?? 0);
            if ($order->paymentMethod === 'debe') {
                $order->status = ($paid + 0.01 >= (float) $order->total) ? 'PAID' : 'PENDING';
                $order->paidAt = $order->status === 'PAID' ? ($order->paidAt ?? now()) : null;
            } else {
                $order->status = 'PAID';
                $order->paidAt = $order->paidAt ?? now();
            }

            $history = $order->statusHistory ?? [];
            $history[] = ['status' => $order->status, 'timestamp' => now()->toIso8601String(), 'note' => 'Venta editada'];
            $order->statusHistory = $history;

            // Historial de ediciones: registrar los campos que cambiaron.
            $after = [
                'subtotal' => (float) $order->subtotal,
                'discount' => (float) $order->discount,
                'total' => (float) $order->total,
                'paymentMethod' => (string) $order->paymentMethod,
                'cashAmount' => (float) ($order->cashAmount ?? 0),
                'cardAmount' => (float) ($order->cardAmount ?? 0),
                'cardReference' => (string) ($order->cardReference ?? ''),
                'cardType' => (string) ($order->cardType ?? ''),
                'cardLastFour' => (string) ($order->cardLastFour ?? ''),
                'customerName' => (string) ($order->customerName ?? ''),
                'notes' => (string) ($order->notes ?? ''),
                'itemsCount' => $editItems ? (int) collect($data['items'])->sum('quantity') : $before['itemsCount'],
            ];
            $changes = $this->buildSaleChanges($before, $after);
            if (! empty($changes)) {
                $editHistory = $order->editHistory ?? [];
                $editHistory[] = [
                    'action' => 'updated',
                    'timestamp' => now()->toIso8601String(),
                    'userId' => $userId,
                    'changes' => $changes,
                ];
                $order->editHistory = $editHistory;
            }

            $order->save();

            // Ajustar el total de la caja abierta por el cambio.
            if ($editItems && $order->cashRegisterId) {
                $session = CashSession::where('cashRegisterId', $order->cashRegisterId)
                    ->where('status', 'OPEN')->first();
                if ($session) {
                    $session->totalSales = (float) $session->totalSales - $oldTotal + (float) $order->total;
                    $session->save();
                }
            }

            return $order->fresh(['items']);
        });
    }

    /**
     * Construye la lista de cambios legibles entre dos snapshots de una venta.
     * Devuelve [{ field, label, from, to }] solo para los campos que cambiaron.
     */
    private function buildSaleChanges(array $before, array $after): array
    {
        $money = ['subtotal', 'discount', 'total', 'cashAmount', 'cardAmount'];
        $labels = [
            'subtotal' => 'Subtotal',
            'discount' => 'Descuento',
            'total' => 'Total',
            'cashAmount' => 'Efectivo recibido',
            'cardAmount' => 'Transferencia/Tarjeta',
            'paymentMethod' => 'Método de pago',
            'cardReference' => 'Referencia',
            'cardType' => 'Tipo de transacción',
            'cardLastFour' => 'Últimos dígitos',
            'customerName' => 'Cliente',
            'notes' => 'Notas',
            'itemsCount' => 'Cantidad de productos',
        ];
        $methods = [
            'cash' => 'Efectivo', 'card' => 'Tarjeta', 'transfer' => 'Transferencia',
            'mixed' => 'Mixto', 'debe' => 'Fiado',
        ];

        $changes = [];
        foreach ($after as $field => $newVal) {
            $oldVal = $before[$field] ?? null;

            if (in_array($field, $money, true)) {
                if (abs((float) $oldVal - (float) $newVal) < 0.01) {
                    continue;
                }
                $from = '$'.number_format((float) $oldVal, 0, ',', '.');
                $to = '$'.number_format((float) $newVal, 0, ',', '.');
            } else {
                if ((string) $oldVal === (string) $newVal) {
                    continue;
                }
                if ($field === 'paymentMethod') {
                    $from = $methods[$oldVal] ?? ($oldVal ?: '—');
                    $to = $methods[$newVal] ?? ($newVal ?: '—');
                } else {
                    $from = ($oldVal === '' || $oldVal === null) ? '—' : $oldVal;
                    $to = ($newVal === '' || $newVal === null) ? '—' : $newVal;
                }
            }

            $changes[] = [
                'field' => $field,
                'label' => $labels[$field] ?? $field,
                'from' => $from,
                'to' => $to,
            ];
        }

        return $changes;
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

    /**
     * Estadísticas/reportes del POS para el vendedor (GET /pos/stats).
     * range: today | 7d | 30d. Agrega en PHP para portabilidad MySQL/Postgres.
     */
    public function posStats(int $sellerId, string $range = 'today'): array
    {
        $now = now();
        switch ($range) {
            case '7d':
                $from = $now->copy()->subDays(6)->startOfDay();
                break;
            case '30d':
                $from = $now->copy()->subDays(29)->startOfDay();
                break;
            default:
                $range = 'today';
                $from = $now->copy()->startOfDay();
                break;
        }

        $orders = Order::with('items')
            ->where('saleChannel', 'POS')
            ->where('sellerId', $sellerId)
            ->where('status', '!=', 'CANCELLED')
            ->where('createdAt', '>=', $from)
            ->get();

        $salesCount = $orders->count();
        $totalSold = (float) $orders->sum('total');
        $itemsSold = 0;

        $methods = [];
        $hours = [];
        for ($h = 0; $h < 24; $h++) {
            $hours[$h] = ['hour' => $h, 'total' => 0.0, 'count' => 0];
        }
        $products = [];

        foreach ($orders as $o) {
            $m = $o->paymentMethod ?: 'cash';
            $methods[$m] ??= ['method' => $m, 'count' => 0, 'total' => 0.0];
            $methods[$m]['count']++;
            $methods[$m]['total'] += (float) $o->total;

            $h = (int) \Illuminate\Support\Carbon::parse($o->createdAt)->format('G');
            $hours[$h]['total'] += (float) $o->total;
            $hours[$h]['count']++;

            foreach ($o->items as $it) {
                $qty = (int) $it->quantity;
                $itemsSold += $qty;
                $key = $it->productName ?: ('#'.$it->variantId);
                $products[$key] ??= ['name' => $key, 'qty' => 0, 'total' => 0.0];
                $products[$key]['qty'] += $qty;
                $products[$key]['total'] += $qty * (float) $it->unitPrice;
            }
        }

        usort($products, fn ($a, $b) => $b['qty'] <=> $a['qty']);
        $topProducts = array_slice(array_values($products), 0, 10);

        return [
            'range' => $range,
            'from' => $from->toIso8601String(),
            'totals' => [
                'salesCount' => $salesCount,
                'totalSold' => $totalSold,
                'avgTicket' => $salesCount > 0 ? round($totalSold / $salesCount) : 0,
                'itemsSold' => $itemsSold,
            ],
            'byMethod' => array_values($methods),
            'byHour' => array_values($hours),
            'topProducts' => $topProducts,
        ];
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

    /** Busca clientes POS por nombre, cédula o teléfono (autocompletar). */
    public function searchCustomers(string $q, int $limit = 10): array
    {
        $q = trim($q);
        if ($q === '') {
            return [];
        }

        // Búsqueda sin distinguir mayúsculas/minúsculas (LOWER funciona en
        // MySQL y PostgreSQL; LIKE en Postgres es sensible a may/min).
        $like = '%'.mb_strtolower($q).'%';

        return POSCustomer::whereRaw('LOWER(name) LIKE ?', [$like])
            ->orWhereRaw('LOWER(cedula) LIKE ?', [$like])
            ->orWhereRaw('LOWER(phone) LIKE ?', [$like])
            ->orderBy('name')
            ->limit($limit)
            ->get()
            ->all();
    }

    /** Lista de clientes POS con su deuda actual (módulo Clientes). */
    public function listCustomers(?string $q = null, int $limit = 100): array
    {
        $query = POSCustomer::query();
        if ($q !== null && trim($q) !== '') {
            $like = '%'.mb_strtolower(trim($q)).'%';
            $query->where(fn ($w) => $w->whereRaw('LOWER(name) LIKE ?', [$like])
                ->orWhereRaw('LOWER(cedula) LIKE ?', [$like])
                ->orWhereRaw('LOWER(phone) LIKE ?', [$like]));
        }
        $customers = $query->orderBy('name')->limit($limit)->get();
        $ids = $customers->pluck('id')->all();

        // Compras, gastado y deuda por cliente (calculado desde las órdenes).
        $agg = [];
        Order::where('saleChannel', 'POS')->whereIn('posCustomerId', $ids)
            ->get(['posCustomerId', 'total', 'status', 'paymentMethod', 'cashAmount', 'cardAmount'])
            ->each(function ($o) use (&$agg) {
                $id = $o->posCustomerId;
                if (! $id) {
                    return;
                }
                $agg[$id] ??= ['count' => 0, 'spent' => 0.0, 'debt' => 0.0];
                if ($o->status !== 'CANCELLED') {
                    $agg[$id]['count']++;
                    $agg[$id]['spent'] += (float) $o->total;
                }
                if ($o->paymentMethod === 'debe' && $o->status === 'PENDING') {
                    $agg[$id]['debt'] += max(0, (float) $o->total - ((float) ($o->cashAmount ?? 0) + (float) ($o->cardAmount ?? 0)));
                }
            });

        return $customers->map(fn ($c) => [
            'id' => $c->id,
            'name' => $c->name,
            'cedula' => $c->cedula,
            'phone' => $c->phone,
            'email' => $c->email,
            'totalPurchases' => (int) ($agg[$c->id]['count'] ?? 0),
            'totalSpent' => (float) ($agg[$c->id]['spent'] ?? 0),
            'debt' => (float) ($agg[$c->id]['debt'] ?? 0),
        ])->all();
    }

    /** Detalle de un cliente POS: info + historial de compras + deuda. */
    public function customerDetail(int $id): ?array
    {
        $c = POSCustomer::find($id);
        if (! $c) {
            return null;
        }

        $orders = Order::where('posCustomerId', $id)
            ->withCount('items')
            ->orderByDesc('createdAt')
            ->get()
            ->map(function ($o) {
                $paid = (float) ($o->cashAmount ?? 0) + (float) ($o->cardAmount ?? 0);

                return [
                    'id' => $o->id,
                    'orderNumber' => $o->orderNumber,
                    'total' => (float) $o->total,
                    'status' => $o->status,
                    'paymentMethod' => $o->paymentMethod,
                    'paid' => $paid,
                    'remaining' => max(0, (float) $o->total - $paid),
                    'itemsCount' => (int) $o->items_count,
                    'createdAt' => $o->createdAt,
                ];
            });

        $nonCancelled = $orders->where('status', '!=', 'CANCELLED');
        $debt = $orders->where('paymentMethod', 'debe')->where('status', 'PENDING')->sum('remaining');

        return [
            'id' => $c->id,
            'name' => $c->name,
            'cedula' => $c->cedula,
            'phone' => $c->phone,
            'email' => $c->email,
            'totalPurchases' => $nonCancelled->count(),
            'totalSpent' => (float) $nonCancelled->sum('total'),
            'debt' => (float) $debt,
            'orders' => $orders->all(),
        ];
    }

    /** Crea o devuelve un cliente POS por nombre (sin requerir cédula). */
    public function findOrCreateCustomerByName(string $name): POSCustomer
    {
        $name = trim($name);
        $existing = POSCustomer::whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first();
        if ($existing) {
            return $existing;
        }

        return POSCustomer::create([
            'name' => $name,
            'cedula' => null,
            'email' => null,
            'phone' => null,
        ]);
    }

    /** Lista los fiados POS pendientes de cobro, con saldo (GET /pos/debts). */
    public function pendingDebts(): array
    {
        return Order::where('saleChannel', 'POS')
            ->where('paymentMethod', 'debe')
            ->where('status', 'PENDING')
            ->orderByDesc('createdAt')
            ->get()
            ->map(function ($o) {
                $paid = (float) ($o->cashAmount ?? 0) + (float) ($o->cardAmount ?? 0);

                return [
                    'id' => $o->id,
                    'orderNumber' => $o->orderNumber,
                    'posCustomerId' => $o->posCustomerId,
                    'customerName' => $o->customerName,
                    'customerPhone' => $o->customerPhone,
                    'total' => (float) $o->total,
                    'paid' => $paid,
                    'remaining' => max(0, (float) $o->total - $paid),
                    'createdAt' => $o->createdAt,
                ];
            })
            ->all();
    }

    /**
     * Registra un abono a un fiado (POST /pos/sale/{id}/collect). Acepta pagos
     * parciales: suma al pagado y salda (PAID) solo cuando se completa el total.
     */
    public function collectDebt(int $orderId, string $paymentMethod, int $userId, ?float $amount = null): Order
    {
        $order = Order::find($orderId);
        if (! $order || $order->saleChannel !== 'POS' || $order->paymentMethod !== 'debe') {
            throw new RuntimeException('Fiado no encontrado');
        }
        if ($order->status !== 'PENDING') {
            throw new RuntimeException('Este fiado ya fue cobrado o cancelado');
        }

        $paid = (float) ($order->cashAmount ?? 0) + (float) ($order->cardAmount ?? 0);
        $remaining = max(0, (float) $order->total - $paid);
        $collect = $amount !== null ? min($amount, $remaining) : $remaining;
        if ($collect <= 0) {
            throw new RuntimeException('El monto a cobrar debe ser mayor a 0');
        }

        // El abono se acumula según el método (efectivo va a cashAmount).
        if ($paymentMethod === 'cash') {
            $order->cashAmount = (float) ($order->cashAmount ?? 0) + $collect;
        } else {
            $order->cardAmount = (float) ($order->cardAmount ?? 0) + $collect;
        }

        $newPaid = (float) ($order->cashAmount ?? 0) + (float) ($order->cardAmount ?? 0);
        $fullyPaid = $newPaid + 0.01 >= (float) $order->total;
        $newRemaining = max(0, (float) $order->total - $newPaid);

        $history = $order->statusHistory ?? [];
        $history[] = [
            'status' => $fullyPaid ? 'PAID' : 'PENDING',
            'timestamp' => now()->toIso8601String(),
            'note' => 'Abono $'.number_format($collect, 0).' - '.$paymentMethod
                .($fullyPaid ? ' (saldado)' : ' (saldo $'.number_format($newRemaining, 0).')'),
        ];
        $order->statusHistory = $history;

        // Historial de ediciones: registrar el abono (dinero añadido).
        $editHistory = $order->editHistory ?? [];
        $editHistory[] = [
            'action' => 'payment',
            'timestamp' => now()->toIso8601String(),
            'userId' => $userId,
            'changes' => [[
                'field' => 'abono',
                'label' => 'Abono recibido',
                'from' => '$'.number_format($remaining, 0, ',', '.').' pendiente',
                'to' => '+$'.number_format($collect, 0, ',', '.').' ('.($paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia').')'
                    .($fullyPaid ? ' · saldado' : ' · queda $'.number_format($newRemaining, 0, ',', '.')),
            ]],
        ];
        $order->editHistory = $editHistory;

        if ($fullyPaid) {
            $order->status = 'PAID';
            $order->paidAt = now();
        }
        $order->save();

        return $order;
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
