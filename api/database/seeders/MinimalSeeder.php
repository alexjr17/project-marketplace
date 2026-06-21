<?php

namespace Database\Seeders;

use App\Models\Announcement;
use App\Models\CashRegister;
use App\Models\Category;
use App\Models\Color;
use App\Models\Discount;
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
        $this->seedSupplierAndPurchase();

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

    /**
     * Compra inicial RECIBIDA que surte el stock de los productos de catálogo:
     * 2 unidades por variante. Así el stock concuerda exactamente con la compra.
     */
    private function seedSupplierAndPurchase(): void
    {
        // El proveedor lo crea InventorySeeder (PROV-0001); si no, lo creamos.
        $supplier = Supplier::firstOrCreate(
            ['code' => 'PROV-0001'],
            ['name' => 'Textiles del Norte S.A.S.', 'country' => 'Colombia', 'isActive' => true]
        );

        $adminId = User::where('email', 'admin@vexa.com')->value('id');
        $qtyPerVariant = 2;
        $unitCost = 18000;

        // Variantes de los productos de catálogo (no plantillas).
        $variants = ProductVariant::whereIn('productId', function ($q) {
            $q->select('id')->from('products')
                ->whereIn('slug', ['sueter-basico', 'gorra-clasica', 'tote-bag-lienzo']);
        })->with('product')->get();

        if ($variants->isEmpty()) {
            return;
        }

        $subtotal = $variants->count() * $qtyPerVariant * $unitCost;

        $order = PurchaseOrder::updateOrCreate(
            ['orderNumber' => 'OC-2026-0001'],
            [
                'supplierId' => $supplier->id,
                'status' => 'RECEIVED',
                'subtotal' => $subtotal,
                'tax' => 0,
                'discount' => 0,
                'total' => $subtotal,
                'orderDate' => now(),
                'expectedDate' => now()->addDays(3),
                'receivedDate' => now(),
                'notes' => 'Compra inicial de inventario (2 unidades por variante).',
                'createdById' => $adminId,
            ]
        );

        // Idempotente: si ya tiene ítems, no volver a recibir/sumar.
        if (PurchaseOrderItem::where('purchaseOrderId', $order->id)->exists()) {
            return;
        }

        foreach ($variants as $variant) {
            PurchaseOrderItem::create([
                'purchaseOrderId' => $order->id,
                'variantId' => $variant->id,
                'description' => ($variant->product?->name ?? 'Producto').' ('.$variant->sku.')',
                'quantity' => $qtyPerVariant,
                'quantityReceived' => $qtyPerVariant,
                'unitCost' => $unitCost,
                'subtotal' => $qtyPerVariant * $unitCost,
            ]);

            $previous = (int) $variant->stock;
            $variant->stock = $previous + $qtyPerVariant;
            $variant->save();

            VariantMovement::create([
                'variantId' => $variant->id,
                'movementType' => 'PURCHASE',
                'quantity' => $qtyPerVariant,
                'previousStock' => $previous,
                'newStock' => $variant->stock,
                'referenceType' => 'purchase_order',
                'referenceId' => $order->id,
                'reason' => 'Recepción de OC-2026-0001 (compra inicial)',
                'userId' => $adminId,
                'unitCost' => $unitCost,
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
