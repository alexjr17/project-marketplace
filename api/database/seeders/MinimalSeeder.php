<?php

namespace Database\Seeders;

use App\Models\Announcement;
use App\Models\CashRegister;
use App\Models\Category;
use App\Models\Color;
use App\Models\Discount;
use App\Models\Input;
use App\Models\InputBatch;
use App\Models\InputBatchMovement;
use App\Models\InputVariant;
use App\Models\InputVariantMovement;
use App\Models\Product;
use App\Models\ProductColor;
use App\Models\ProductSize;
use App\Models\ProductType;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Size;
use App\Models\Supplier;
use App\Models\TemplateZone;
use App\Models\User;
use App\Models\VariantMovement;
use App\Models\ZoneType;
use Illuminate\Database\Seeder;

/**
 * Datos mínimos de arranque (demo limpia):
 *  - 1 producto CON variantes (color × talla)
 *  - 1 producto SIN variantes (simple, una sola variante)
 *  - 2 plantillas personalizables (Suéter Básico y Suéter Oversize)
 *  - ejemplos de publicidad / anuncios
 *  - ejemplos de descuento (cupón con código y oferta automática)
 *  - una sola caja registradora
 *
 * Depende de CatalogSeeder (categorías, tipos, colores, tallas, zonas).
 */
class MinimalSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedProductWithVariants();
        $this->seedSimpleProduct();
        $this->seedGorra();
        $this->seedTemplate('sueter-basico', 'Suéter Básico', 70000, 'TPL-0001');
        $this->seedTemplate('sueter-oversize', 'Suéter Oversize', 78000, 'TPL-0002');
        $this->seedAnnouncements();
        $this->seedDiscounts();
        $this->seedCashRegister();
        $this->seedPurchases();

        $this->command?->info('MinimalSeeder: datos mínimos sembrados.');
    }

    /** Producto de catálogo CON variantes (3 colores × 4 tallas): Suéter Básico. */
    private function seedProductWithVariants(): void
    {
        $type = ProductType::where('slug', 'sueter-basico')->first();
        $product = Product::updateOrCreate(
            ['slug' => 'sueter-basico'],
            [
                'sku' => 'PRD-0001',
                'name' => 'Suéter Básico',
                'description' => 'Suéter de corte clásico en algodón perchado. Disponible en varios colores y tallas.',
                'categoryId' => $type?->categoryId,
                'typeId' => $type?->id,
                'basePrice' => 58000,
                'stock' => 0,
                'featured' => true,
                'isActive' => true,
                'isTemplate' => false,
                'images' => ['front' => '', 'back' => '', 'side' => ''],
                'tags' => ['sueter', 'basico', 'catalogo'],
                'reviewsCount' => 0,
            ]
        );

        $colors = Color::whereIn('slug', ['blanco', 'negro', 'gris-jaspe'])->get();
        $sizes = Size::whereIn('abbreviation', ['S', 'M', 'L', 'XL'])->get();

        foreach ($colors as $color) {
            ProductColor::updateOrCreate(['productId' => $product->id, 'colorId' => $color->id]);
        }
        foreach ($sizes as $size) {
            ProductSize::updateOrCreate(['productId' => $product->id, 'sizeId' => $size->id]);
        }
        foreach ($colors as $color) {
            foreach ($sizes as $size) {
                ProductVariant::updateOrCreate(
                    ['productId' => $product->id, 'colorId' => $color->id, 'sizeId' => $size->id],
                    [
                        'sku' => 'PRD-0001-'.strtoupper(substr($color->slug, 0, 3)).'-'.$size->abbreviation,
                        'barcode' => $this->ean13(),
                        'stock' => 0, // el stock entra por la compra recibida
                        'minStock' => 3,
                        'isActive' => true,
                    ]
                );
            }
        }
    }

    /** Producto simple SIN variantes (una sola variante color/talla nulos). */
    private function seedSimpleProduct(): void
    {
        $type = ProductType::where('slug', 'tote-bag')->first();
        $category = $type?->categoryId
            ? Category::find($type->categoryId)
            : (Category::where('slug', 'accesorios')->first() ?? Category::where('slug', 'blusas')->first());
        $product = Product::updateOrCreate(
            ['slug' => 'tote-bag-lienzo'],
            [
                'sku' => 'PRD-0002',
                'name' => 'Tote Bag de Lienzo',
                'description' => 'Bolso tote de lienzo resistente. Producto simple, talla única, sin variantes.',
                'categoryId' => $category?->id,
                'typeId' => $type?->id,
                'basePrice' => 25000,
                'stock' => 0,
                'featured' => false,
                'isActive' => true,
                'isTemplate' => false,
                'images' => ['front' => '', 'back' => '', 'side' => ''],
                'tags' => ['accesorio', 'tote'],
                'reviewsCount' => 0,
            ]
        );

        // Producto simple: una única variante con color/talla nulos. Stock por compra.
        ProductVariant::updateOrCreate(
            ['productId' => $product->id, 'colorId' => null, 'sizeId' => null],
            [
                'sku' => 'PRD-0002-U',
                'barcode' => $this->ean13(),
                'stock' => 0,
                'minStock' => 5,
                'isActive' => true,
            ]
        );
    }

    /** Producto Gorra (3 colores, talla única): variantes por color. */
    private function seedGorra(): void
    {
        $type = ProductType::where('slug', 'gorra')->first();
        $product = Product::updateOrCreate(
            ['slug' => 'gorra-clasica'],
            [
                'sku' => 'PRD-0003',
                'name' => 'Gorra Clásica',
                'description' => 'Gorra ajustable para bordado o estampado. Talla única.',
                'categoryId' => $type?->categoryId,
                'typeId' => $type?->id,
                'basePrice' => 30000,
                'stock' => 0,
                'featured' => false,
                'isActive' => true,
                'isTemplate' => false,
                'images' => ['front' => '', 'back' => '', 'side' => ''],
                'tags' => ['accesorio', 'gorra'],
                'reviewsCount' => 0,
            ]
        );

        $colors = Color::whereIn('slug', ['blanco', 'negro', 'azul-marino'])->get();
        $sizeU = Size::where('abbreviation', 'U')->first();

        foreach ($colors as $color) {
            ProductColor::updateOrCreate(['productId' => $product->id, 'colorId' => $color->id]);
        }
        if ($sizeU) {
            ProductSize::updateOrCreate(['productId' => $product->id, 'sizeId' => $sizeU->id]);
        }
        foreach ($colors as $color) {
            ProductVariant::updateOrCreate(
                ['productId' => $product->id, 'colorId' => $color->id, 'sizeId' => $sizeU?->id],
                [
                    'sku' => 'PRD-0003-'.strtoupper(substr($color->slug, 0, 3)),
                    'barcode' => $this->ean13(),
                    'stock' => 0, // el stock entra por la compra recibida
                    'minStock' => 3,
                    'isActive' => true,
                ]
            );
        }
    }

    /** Plantilla personalizable (isTemplate) con zonas frente/espalda y variantes. */
    private function seedTemplate(string $typeSlug, string $label, int $price, string $sku): void
    {
        $type = ProductType::where('slug', $typeSlug)->first();
        $template = Product::updateOrCreate(
            ['slug' => $typeSlug.'-personalizable'],
            [
                'sku' => $sku,
                'name' => $label.' Personalizable',
                'description' => $label.' para dama listo para personalizar con tu diseño en frente y espalda.',
                'categoryId' => $type?->categoryId,
                'typeId' => $type?->id,
                'basePrice' => $price,
                'stock' => 0,
                'featured' => true,
                'isActive' => true,
                'isTemplate' => true,
                'images' => ['front' => '', 'back' => '', 'side' => ''],
                'tags' => ['personalizable', $typeSlug, 'dama'],
                'reviewsCount' => 0,
            ]
        );

        $colors = Color::whereIn('slug', ['blanco', 'negro', 'gris-jaspe'])->get();
        $sizes = Size::whereIn('abbreviation', ['U', 'S', 'M', 'L', 'XL'])->get();

        foreach ($colors as $color) {
            ProductColor::updateOrCreate(['productId' => $template->id, 'colorId' => $color->id]);
        }
        foreach ($sizes as $size) {
            ProductSize::updateOrCreate(['productId' => $template->id, 'sizeId' => $size->id]);
        }
        foreach ($colors as $color) {
            foreach ($sizes as $size) {
                ProductVariant::updateOrCreate(
                    ['productId' => $template->id, 'colorId' => $color->id, 'sizeId' => $size->id],
                    [
                        'sku' => $sku.'-'.strtoupper(substr($color->slug, 0, 3)).'-'.$size->abbreviation,
                        'barcode' => $this->ean13(),
                        'stock' => 0,
                        'minStock' => 0,
                        'isActive' => true,
                    ]
                );
            }
        }

        $zoneDefs = [
            ['slug' => 'frente', 'name' => 'Frente', 'required' => true],
            ['slug' => 'espalda', 'name' => 'Espalda', 'required' => false],
        ];
        foreach ($zoneDefs as $i => $zd) {
            $zoneType = ZoneType::where('slug', $zd['slug'])->first();
            if (! $zoneType) {
                continue;
            }
            TemplateZone::updateOrCreate(
                ['templateId' => $template->id, 'zoneTypeId' => $zoneType->id],
                [
                    'zoneId' => 'zone-'.$zd['slug'],
                    'name' => $zd['name'],
                    'description' => 'Área de personalización: '.strtolower($zd['name']),
                    'shape' => 'rect',
                    'maxWidth' => 280,
                    'maxHeight' => 360,
                    'positionX' => 110,
                    'positionY' => 90,
                    'isEditable' => true,
                    'isRequired' => $zd['required'],
                    'isBlocked' => false,
                    'price' => 8000,
                    'sortOrder' => $i + 1,
                    'isActive' => true,
                ]
            );
        }
    }

    /** Ejemplos de publicidad / anuncios. */
    private function seedAnnouncements(): void
    {
        $items = [
            // Único activo por defecto.
            [
                'type' => 'bar', 'variant' => 'promo', 'title' => '¡Envío gratis desde $150.000!',
                'message' => 'Aprovecha hoy en toda la tienda.', 'priority' => 10, 'isActive' => true,
            ],
            // Los demás quedan creados pero INACTIVOS (ejemplos para activar luego).
            [
                'type' => 'marquee', 'variant' => 'dark', 'title' => 'Nuevos diseños cada semana ✨',
                'message' => 'Personaliza tu suéter como quieras.', 'priority' => 5, 'isActive' => false,
            ],
            [
                'type' => 'popup', 'variant' => 'promo', 'title' => '¡Bienvenido!',
                'message' => 'Usa el cupón BIENVENIDA10 y obtén 10% en tu primera compra.',
                'couponCode' => 'BIENVENIDA10', 'frequency' => 'session', 'priority' => 8, 'isActive' => false,
            ],
            [
                'type' => 'countdown', 'variant' => 'warning', 'title' => 'Oferta por tiempo limitado',
                'message' => '¡Corre antes de que termine!', 'priority' => 7,
                'endsAt' => now()->addDays(5), 'isActive' => false,
            ],
        ];

        foreach ($items as $a) {
            Announcement::updateOrCreate(
                ['type' => $a['type'], 'title' => $a['title']],
                array_merge([
                    'message' => null, 'imageUrl' => null, 'ctaText' => 'Ver tienda', 'ctaUrl' => '/catalog',
                    'couponCode' => null, 'variant' => 'info', 'isActive' => true, 'dismissible' => true,
                    'target' => 'all', 'frequency' => 'always', 'priority' => 0, 'startsAt' => null, 'endsAt' => null,
                ], $a)
            );
        }
    }

    /** Ejemplos de descuento: un cupón con código y una oferta automática. */
    private function seedDiscounts(): void
    {
        // Cupón con código: 10% en todo el pedido (tienda).
        Discount::updateOrCreate(
            ['code' => 'BIENVENIDA10'],
            [
                'isAuto' => false, 'name' => 'Bienvenida 10%', 'type' => 'percent', 'value' => 10,
                'appliesTo' => 'all', 'targetIds' => [], 'channel' => 'all', 'minSubtotal' => null,
                'maxUses' => null, 'maxUsesPerUser' => 1, 'isActive' => true, 'startsAt' => null, 'endsAt' => null,
            ]
        );

        // Oferta automática: 15% en la categoría Suéteres (tienda y POS).
        $sueteres = Category::where('slug', 'sueteres')->first();
        if ($sueteres) {
            Discount::updateOrCreate(
                ['name' => 'Oferta Suéteres 15%'],
                [
                    'isAuto' => true, 'code' => null, 'type' => 'percent', 'value' => 15,
                    'appliesTo' => 'category', 'targetIds' => [$sueteres->id], 'channel' => 'all',
                    'minSubtotal' => null, 'maxUses' => null, 'maxUsesPerUser' => null,
                    'isActive' => true, 'startsAt' => null, 'endsAt' => null,
                ]
            );
        }
    }

    /** Una sola caja registradora. */
    private function seedCashRegister(): void
    {
        CashRegister::updateOrCreate(
            ['code' => 'CAJA-01'],
            [
                'name' => 'Caja Principal',
                'location' => 'Tienda',
                'isActive' => true,
                'categoryIds' => [], // vacío = puede vender todas las categorías
            ]
        );
    }

    /** Tres compras recibidas: productos, plantillas e insumos. */
    private function seedPurchases(): void
    {
        $supplier = Supplier::firstOrCreate(
            ['code' => 'PROV-0001'],
            ['name' => 'Textiles del Norte S.A.S.', 'country' => 'Colombia', 'isActive' => true]
        );
        $adminId = User::where('email', 'admin@vexa.com')->value('id');

        // 1) Productos de catálogo (2 unidades por variante).
        $this->receiveProductVariants('OC-2026-0001', $supplier->id, $adminId,
            ['sueter-basico', 'gorra-clasica', 'tote-bag-lienzo'],
            'Compra de productos (2 unidades por variante).', 18000, 2);

        // 2) Plantillas personalizables (2 unidades por variante).
        $this->receiveProductVariants('OC-2026-0002', $supplier->id, $adminId,
            ['sueter-basico-personalizable', 'sueter-oversize-personalizable'],
            'Compra de plantillas (2 unidades por variante).', 22000, 2);

        // 3) Insumos / materia prima.
        $this->receiveInputs('OC-2026-0003', $supplier->id, $adminId);
    }

    /** Compra RECIBIDA de las variantes de los productos con esos slugs. */
    private function receiveProductVariants(string $number, int $supplierId, ?int $adminId, array $slugs, string $notes, int $unitCost, int $qty): void
    {
        $variants = ProductVariant::whereIn('productId', function ($q) use ($slugs) {
            $q->select('id')->from('products')->whereIn('slug', $slugs);
        })->with('product')->get();
        if ($variants->isEmpty()) {
            return;
        }

        $order = PurchaseOrder::updateOrCreate(
            ['orderNumber' => $number],
            [
                'supplierId' => $supplierId, 'status' => 'RECEIVED',
                'subtotal' => $variants->count() * $qty * $unitCost, 'tax' => 0, 'discount' => 0,
                'total' => $variants->count() * $qty * $unitCost,
                'orderDate' => now(), 'expectedDate' => now()->addDays(3), 'receivedDate' => now(),
                'notes' => $notes, 'createdById' => $adminId,
            ]
        );
        if (PurchaseOrderItem::where('purchaseOrderId', $order->id)->exists()) {
            return;
        }

        foreach ($variants as $variant) {
            PurchaseOrderItem::create([
                'purchaseOrderId' => $order->id, 'variantId' => $variant->id,
                'description' => ($variant->product?->name ?? 'Producto').' ('.$variant->sku.')',
                'quantity' => $qty, 'quantityReceived' => $qty,
                'unitCost' => $unitCost, 'subtotal' => $qty * $unitCost,
            ]);
            $previous = (int) $variant->stock;
            $variant->stock = $previous + $qty;
            $variant->save();
            VariantMovement::create([
                'variantId' => $variant->id, 'movementType' => 'PURCHASE', 'quantity' => $qty,
                'previousStock' => $previous, 'newStock' => $variant->stock,
                'referenceType' => 'purchase_order', 'referenceId' => $order->id,
                'reason' => "Recepción de {$number}", 'userId' => $adminId, 'unitCost' => $unitCost,
            ]);
        }
    }

    /** Compra RECIBIDA de insumos: prendas base (por variante) + consumibles. */
    private function receiveInputs(string $number, int $supplierId, ?int $adminId): void
    {
        $inputVariants = InputVariant::with('input')->get();
        $consumibles = Input::whereIn('code', ['INS-0003', 'INS-0004', 'INS-0005', 'INS-0006', 'INS-0007'])->get();
        if ($inputVariants->isEmpty() && $consumibles->isEmpty()) {
            return;
        }

        $qtyVariant = 5;
        $consumibleQty = ['INS-0003' => 200, 'INS-0004' => 10, 'INS-0005' => 200, 'INS-0006' => 100, 'INS-0007' => 200];
        $subtotal = $inputVariants->sum(fn ($iv) => $qtyVariant * (float) $iv->unitCost)
            + $consumibles->sum(fn ($i) => ($consumibleQty[$i->code] ?? 0) * (float) $i->unitCost);

        $order = PurchaseOrder::updateOrCreate(
            ['orderNumber' => $number],
            [
                'supplierId' => $supplierId, 'status' => 'RECEIVED',
                'subtotal' => $subtotal, 'tax' => 0, 'discount' => 0, 'total' => $subtotal,
                'orderDate' => now(), 'expectedDate' => now()->addDays(5), 'receivedDate' => now(),
                'notes' => 'Compra de insumos (prendas base y consumibles).', 'createdById' => $adminId,
            ]
        );
        if (PurchaseOrderItem::where('purchaseOrderId', $order->id)->exists()) {
            return;
        }

        // Prendas base: por variante de insumo.
        foreach ($inputVariants as $iv) {
            PurchaseOrderItem::create([
                'purchaseOrderId' => $order->id, 'inputVariantId' => $iv->id, 'inputId' => $iv->inputId,
                'description' => ($iv->input?->name ?? 'Insumo').' ('.$iv->sku.')',
                'quantity' => $qtyVariant, 'quantityReceived' => $qtyVariant,
                'unitCost' => (float) $iv->unitCost, 'subtotal' => $qtyVariant * (float) $iv->unitCost,
            ]);
            $previous = (float) $iv->currentStock;
            $iv->currentStock = $previous + $qtyVariant;
            $iv->save();
            InputVariantMovement::create([
                'inputVariantId' => $iv->id, 'movementType' => 'ENTRADA', 'quantity' => $qtyVariant,
                'previousStock' => $previous, 'newStock' => $iv->currentStock,
                'referenceType' => 'purchase_order', 'referenceId' => $order->id,
                'reason' => "Recepción de {$number}", 'userId' => $adminId, 'unitCost' => (float) $iv->unitCost,
            ]);
        }
        // El stock del insumo prenda base = suma de sus variantes.
        foreach ($inputVariants->pluck('inputId')->unique() as $inputId) {
            Input::where('id', $inputId)->update(['currentStock' => InputVariant::where('inputId', $inputId)->sum('currentStock')]);
        }

        // Consumibles: por lote.
        foreach ($consumibles as $i => $input) {
            $qty = $consumibleQty[$input->code] ?? 0;
            PurchaseOrderItem::create([
                'purchaseOrderId' => $order->id, 'inputId' => $input->id,
                'description' => $input->name,
                'quantity' => $qty, 'quantityReceived' => $qty,
                'unitCost' => (float) $input->unitCost, 'subtotal' => $qty * (float) $input->unitCost,
            ]);
            $input->currentStock = (float) $input->currentStock + $qty;
            $input->save();
            $batch = InputBatch::create([
                'inputId' => $input->id, 'batchNumber' => "{$number}-".($i + 1),
                'supplier' => 'Textiles del Norte S.A.S.', 'initialQuantity' => $qty, 'currentQuantity' => $qty,
                'reservedQuantity' => 0, 'unitCost' => (float) $input->unitCost, 'totalCost' => $qty * (float) $input->unitCost,
                'purchaseDate' => now(), 'notes' => "Lote de {$number}.", 'isActive' => true,
            ]);
            InputBatchMovement::create([
                'inputId' => $input->id, 'inputBatchId' => $batch->id, 'movementType' => 'ENTRADA',
                'quantity' => $qty, 'referenceType' => 'purchase_order', 'referenceId' => $order->id,
                'reason' => "Recepción de {$number}", 'userId' => $adminId,
            ]);
        }
    }

    /** Código de barras EAN-13 válido (12 dígitos + verificador). */
    private function ean13(): string
    {
        $base = '';
        for ($i = 0; $i < 12; $i++) {
            $base .= random_int(0, 9);
        }
        $sum = 0;
        for ($i = 0; $i < 12; $i++) {
            $sum += (int) $base[$i] * ($i % 2 === 0 ? 1 : 3);
        }

        return $base.((10 - ($sum % 10)) % 10);
    }
}
