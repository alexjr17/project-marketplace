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
        $this->seedTemplate('sueter-basico', 'Suéter Básico', 70000, 'TPL-0001');
        $this->seedTemplate('sueter-oversize', 'Suéter Oversize', 78000, 'TPL-0002');
        $this->seedAnnouncements();
        $this->seedDiscounts();
        $this->seedCashRegister();
        $this->seedSupplierAndPurchase();

        $this->command?->info('MinimalSeeder: datos mínimos sembrados.');
    }

    /** Producto de catálogo CON variantes (3 colores × 4 tallas). */
    private function seedProductWithVariants(): void
    {
        $type = ProductType::where('slug', 'buso')->first();
        $product = Product::updateOrCreate(
            ['slug' => 'buso-clasico'],
            [
                'sku' => 'PRD-0001',
                'name' => 'Buso Clásico',
                'description' => 'Buso para dama en algodón perchado. Disponible en varios colores y tallas.',
                'categoryId' => $type?->categoryId,
                'typeId' => $type?->id,
                'basePrice' => 70000,
                'stock' => 0,
                'featured' => true,
                'isActive' => true,
                'isTemplate' => false,
                'images' => ['front' => '', 'back' => '', 'side' => ''],
                'tags' => ['buso', 'dama', 'catalogo'],
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
                        'stock' => 10,
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
        $category = Category::where('slug', 'blusas')->first() ?? Category::where('slug', 'sueteres')->first();
        $product = Product::updateOrCreate(
            ['slug' => 'tote-bag-lienzo'],
            [
                'sku' => 'PRD-0002',
                'name' => 'Tote Bag de Lienzo',
                'description' => 'Bolso tote de lienzo resistente. Producto simple, talla única, sin variantes.',
                'categoryId' => $category?->id,
                'typeId' => null,
                'basePrice' => 25000,
                'stock' => 30,
                'featured' => false,
                'isActive' => true,
                'isTemplate' => false,
                'images' => ['front' => '', 'back' => '', 'side' => ''],
                'tags' => ['accesorio', 'tote'],
                'reviewsCount' => 0,
            ]
        );

        // Producto simple: una única variante con color/talla nulos.
        ProductVariant::updateOrCreate(
            ['productId' => $product->id, 'colorId' => null, 'sizeId' => null],
            [
                'sku' => 'PRD-0002-U',
                'barcode' => $this->ean13(),
                'stock' => 30,
                'minStock' => 5,
                'isActive' => true,
            ]
        );
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
            [
                'type' => 'bar', 'variant' => 'promo', 'title' => '¡Envío gratis desde $150.000!',
                'message' => 'Aprovecha hoy en toda la tienda.', 'priority' => 10,
            ],
            [
                'type' => 'marquee', 'variant' => 'dark', 'title' => 'Nuevos diseños cada semana ✨',
                'message' => 'Personaliza tu suéter como quieras.', 'priority' => 5,
            ],
            [
                'type' => 'popup', 'variant' => 'promo', 'title' => '¡Bienvenido!',
                'message' => 'Usa el cupón BIENVENIDA10 y obtén 10% en tu primera compra.',
                'couponCode' => 'BIENVENIDA10', 'frequency' => 'session', 'priority' => 8,
            ],
            [
                'type' => 'countdown', 'variant' => 'warning', 'title' => 'Oferta por tiempo limitado',
                'message' => '¡Corre antes de que termine!', 'priority' => 7,
                'endsAt' => now()->addDays(5),
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

    /** Proveedor de ejemplo + una compra recibida de una sola unidad. */
    private function seedSupplierAndPurchase(): void
    {
        $supplier = Supplier::updateOrCreate(
            ['code' => 'PROV-0001'],
            [
                'name' => 'Textiles del Caribe',
                'contactName' => 'Proveedor Ejemplo',
                'email' => 'ventas@textilescaribe.com',
                'phone' => '+57 305 555 5555',
                'city' => 'Barranquilla',
                'department' => 'Atlántico',
                'country' => 'Colombia',
                'isActive' => true,
            ]
        );

        $product = Product::where('slug', 'buso-clasico')->first();
        $variant = $product ? ProductVariant::where('productId', $product->id)->orderBy('id')->first() : null;
        if (! $variant) {
            return;
        }

        $adminId = User::where('email', 'alexjose.r.r@gmail.com')->value('id');
        $unitCost = 40000;

        $order = PurchaseOrder::updateOrCreate(
            ['orderNumber' => 'OC-2026-0001'],
            [
                'supplierId' => $supplier->id,
                'status' => 'RECEIVED',
                'subtotal' => $unitCost,
                'tax' => 0,
                'discount' => 0,
                'total' => $unitCost,
                'orderDate' => now(),
                'expectedDate' => now()->addDays(3),
                'receivedDate' => now(),
                'notes' => 'Compra de ejemplo: 1 unidad.',
                'createdById' => $adminId,
            ]
        );

        // Idempotente: no duplicar el ítem ni volver a sumar stock.
        if (PurchaseOrderItem::where('purchaseOrderId', $order->id)->exists()) {
            return;
        }

        PurchaseOrderItem::create([
            'purchaseOrderId' => $order->id,
            'variantId' => $variant->id,
            'description' => $product->name.' ('.$variant->sku.')',
            'quantity' => 1,
            'quantityReceived' => 1,
            'unitCost' => $unitCost,
            'subtotal' => $unitCost,
        ]);

        // Recepción: suma 1 unidad al stock de la variante y registra el movimiento.
        $previous = (int) $variant->stock;
        $variant->stock = $previous + 1;
        $variant->save();

        VariantMovement::create([
            'variantId' => $variant->id,
            'movementType' => 'PURCHASE',
            'quantity' => 1,
            'previousStock' => $previous,
            'newStock' => $variant->stock,
            'referenceType' => 'purchase_order',
            'referenceId' => $order->id,
            'reason' => 'Recepción de OC-2026-0001 (compra de ejemplo)',
            'userId' => $adminId,
            'unitCost' => $unitCost,
        ]);
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
