<?php

namespace Database\Seeders;

use App\Models\Color;
use App\Models\Input;
use App\Models\InputVariant;
use App\Models\Product;
use App\Models\ProductColor;
use App\Models\ProductInput;
use App\Models\ProductSize;
use App\Models\ProductType;
use App\Models\ProductVariant;
use App\Models\Size;
use App\Models\TemplateRecipe;
use App\Models\TemplateZone;
use App\Models\ZoneType;
use Database\Seeders\Concerns\GarmentCatalog;
use Illuminate\Database\Seeder;

/**
 * Productos de arranque. Por cada tipo de prenda crea dos productos:
 *  - un producto modelo (plantilla personalizable, isTemplate = true)
 *  - un producto normal de catálogo (isTemplate = false)
 * Las variantes se crean en stock CERO; el stock de los productos normales
 * entra después mediante órdenes de compra recibidas (ver PurchaseSeeder).
 */
class CommerceSeeder extends Seeder
{
    use GarmentCatalog;

    public function run(): void
    {
        $colors = Color::whereIn('slug', $this->garmentColorSlugs)->get()->keyBy('slug');

        // Consumibles que usa toda prenda personalizada (cinta y papel transfer).
        $consumibles = Input::whereIn('code', ['INS-0005', 'INS-0006'])->pluck('id', 'code');

        foreach ($this->garments() as $g) {
            $type = ProductType::where('slug', $g['typeSlug'])->first();
            $sizes = Size::whereIn('abbreviation', $g['sizes'])->get()->keyBy('abbreviation');

            $this->seedTemplate($g, $type, $colors, $sizes, $consumibles);
            $this->seedNormalProduct($g, $type, $colors, $sizes);
        }
    }

    /** Producto modelo (plantilla personalizable) de un tipo de prenda. */
    private function seedTemplate(array $g, ?ProductType $type, $colors, $sizes, $consumibles): void
    {
        $template = Product::updateOrCreate(
            ['slug' => $g['typeSlug'].'-personalizable'],
            [
                'sku' => $g['templateSku'],
                'name' => $g['label'].' Personalizable',
                'description' => $g['label'].' para dama listo para personalizar con tu diseño en frente y espalda.',
                'categoryId' => $type?->categoryId,
                'typeId' => $type?->id,
                'basePrice' => $g['templatePrice'],
                'stock' => 0,
                'featured' => true,
                'isActive' => true,
                'isTemplate' => true,
                'images' => ['front' => '', 'back' => '', 'side' => ''],
                'tags' => ['personalizable', $g['typeSlug'], 'dama'],
                'reviewsCount' => 0,
            ]
        );

        $this->syncColorsAndSizes($template->id, $colors, $sizes);
        $this->seedVariants($template->id, $g['templateSku'], $colors, $sizes, minStock: 0);

        // Zonas personalizables: frente (obligatoria) y espalda (opcional)
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

        // Insumos asociados a la plantilla: su prenda base + los consumibles.
        $baseInput = Input::where('code', $g['baseInputCode'])->first();
        $inputIds = $consumibles->values()->all();
        if ($baseInput) {
            array_unshift($inputIds, $baseInput->id);
        }
        foreach ($inputIds as $inputId) {
            ProductInput::updateOrCreate(['productId' => $template->id, 'inputId' => $inputId]);
        }

        // Recetas: cada variante de la plantilla consume 1 unidad de la
        // variante de prenda base del mismo color y talla.
        if ($baseInput) {
            $inputVariants = InputVariant::where('inputId', $baseInput->id)
                ->get()->keyBy(fn ($iv) => $iv->colorId.'-'.$iv->sizeId);

            foreach (ProductVariant::where('productId', $template->id)->get() as $variant) {
                $iv = $inputVariants->get($variant->colorId.'-'.$variant->sizeId);
                if ($iv) {
                    TemplateRecipe::updateOrCreate(
                        ['variantId' => $variant->id, 'inputVariantId' => $iv->id],
                        ['quantity' => 1]
                    );
                }
            }
        }
    }

    /** Producto normal de catálogo (no personalizable) de un tipo de prenda. */
    private function seedNormalProduct(array $g, ?ProductType $type, $colors, $sizes): void
    {
        $product = Product::updateOrCreate(
            ['slug' => $g['typeSlug']],
            [
                'sku' => $g['normalSku'],
                'name' => $g['label'],
                'description' => $g['label'].' para dama en algodón perchado. Producto de catálogo, listo para la venta.',
                'categoryId' => $type?->categoryId,
                'typeId' => $type?->id,
                'basePrice' => $g['normalPrice'],
                'stock' => 0,
                'featured' => false,
                'isActive' => true,
                'isTemplate' => false,
                'images' => ['front' => '', 'back' => '', 'side' => ''],
                'tags' => [$g['typeSlug'], 'dama', 'catalogo'],
                'reviewsCount' => 0,
            ]
        );

        $this->syncColorsAndSizes($product->id, $colors, $sizes);
        // Variantes en stock cero; se surten por orden de compra (PurchaseSeeder).
        $this->seedVariants($product->id, $g['normalSku'], $colors, $sizes, minStock: 5);
    }

    /** Asocia los colores y tallas ofrecidos a un producto. */
    private function syncColorsAndSizes(int $productId, $colors, $sizes): void
    {
        foreach ($this->garmentColorSlugs as $slug) {
            ProductColor::updateOrCreate(['productId' => $productId, 'colorId' => $colors[$slug]->id]);
        }
        foreach ($sizes as $size) {
            ProductSize::updateOrCreate(['productId' => $productId, 'sizeId' => $size->id]);
        }
    }

    /**
     * Crea una variante por cada combinación color × talla, en stock CERO.
     * El stock entra después por órdenes de compra (ver PurchaseSeeder).
     */
    private function seedVariants(int $productId, string $skuPrefix, $colors, $sizes, int $minStock): void
    {
        foreach ($this->garmentColorSlugs as $slug) {
            foreach ($sizes as $abbr => $size) {
                ProductVariant::updateOrCreate(
                    [
                        'productId' => $productId,
                        'colorId' => $colors[$slug]->id,
                        'sizeId' => $size->id,
                    ],
                    [
                        'sku' => $skuPrefix.'-'.$this->colorTag($slug).'-'.$abbr,
                        'barcode' => $this->ean13(),
                        'stock' => 0,
                        'minStock' => $minStock,
                        'isActive' => true,
                    ]
                );
            }
        }
    }

    /** Genera un código de barras EAN-13 válido (12 dígitos + verificador). */
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
