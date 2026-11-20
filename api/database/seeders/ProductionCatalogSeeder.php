<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Color;
use App\Models\Product;
use App\Models\ProductColor;
use App\Models\ProductSize;
use App\Models\ProductType;
use App\Models\ProductVariant;
use App\Models\Size;
use App\Models\TemplateZone;
use App\Models\ZoneType;
use Illuminate\Database\Seeder;
use RuntimeException;

class ProductionCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $path = __DIR__.'/data/production_catalog.json';
        if (! is_file($path)) {
            throw new RuntimeException("No se encontró el catálogo inicial: {$path}");
        }

        $json = file_get_contents($path);
        if ($json === false) {
            throw new RuntimeException("No se pudo leer el catálogo inicial: {$path}");
        }

        $catalog = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        if (! isset($catalog['products']) || ! is_array($catalog['products'])) {
            throw new RuntimeException('El catálogo inicial no contiene una lista válida de productos.');
        }

        $categoryIds = Category::query()->pluck('id', 'slug')->all();
        $productTypeIds = ProductType::query()->pluck('id', 'slug')->all();
        $colorIds = Color::query()->pluck('id', 'slug')->all();
        $sizeIds = Size::query()->pluck('id', 'abbreviation')->all();
        $zoneTypeIds = ZoneType::query()->pluck('id', 'slug')->all();

        foreach ($catalog['products'] as $data) {
            $categoryId = $this->requireId($categoryIds, $data['categorySlug'], 'categoría');
            $typeId = $data['typeSlug'] === null
                ? null
                : $this->requireId($productTypeIds, $data['typeSlug'], 'tipo de producto');

            $product = Product::updateOrCreate(
                ['sku' => $data['sku']],
                [
                    'slug' => $data['slug'],
                    'name' => $data['name'],
                    'description' => $data['description'],
                    'barcode' => $data['barcode'],
                    'categoryId' => $categoryId,
                    'typeId' => $typeId,
                    'basePrice' => $data['basePrice'],
                    'featured' => $data['featured'],
                    'isActive' => $data['isActive'],
                    'isTemplate' => $data['isTemplate'],
                    'images' => $data['images'],
                    'tags' => $data['tags'],
                    'zoneTypeImages' => $data['zoneTypeImages'],
                    'designZones' => $data['designZones'],
                    'exclusionZones' => $data['exclusionZones'],
                ]
            );

            foreach ($data['colors'] as $slug) {
                $colorId = $this->requireId($colorIds, $slug, 'color');
                ProductColor::updateOrCreate(
                    ['productId' => $product->id, 'colorId' => $colorId]
                );
            }

            foreach ($data['sizes'] as $abbreviation) {
                $sizeId = $this->requireId($sizeIds, $abbreviation, 'talla');
                ProductSize::updateOrCreate(
                    ['productId' => $product->id, 'sizeId' => $sizeId]
                );
            }

            foreach ($data['variants'] as $variantData) {
                $variantColorId = $variantData['colorSlug'] === null
                    ? null
                    : $this->requireId($colorIds, $variantData['colorSlug'], 'color de variante');
                $variantSizeId = $variantData['sizeAbbreviation'] === null
                    ? null
                    : $this->requireId($sizeIds, $variantData['sizeAbbreviation'], 'talla de variante');

                ProductVariant::updateOrCreate(
                    ['sku' => $variantData['sku']],
                    [
                        'productId' => $product->id,
                        'colorId' => $variantColorId,
                        'sizeId' => $variantSizeId,
                        'barcode' => $variantData['barcode'],
                        'minStock' => $variantData['minStock'],
                        'priceAdjustment' => $variantData['priceAdjustment'],
                        'isActive' => $variantData['isActive'],
                    ]
                );
            }

            foreach ($data['templateZones'] as $zoneData) {
                $zoneTypeId = $this->requireId($zoneTypeIds, $zoneData['zoneTypeSlug'], 'zona de plantilla');
                TemplateZone::updateOrCreate(
                    ['templateId' => $product->id, 'zoneId' => $zoneData['zoneId']],
                    [
                        'zoneTypeId' => $zoneTypeId,
                        'name' => $zoneData['name'],
                        'description' => $zoneData['description'],
                        'shape' => $zoneData['shape'],
                        'maxWidth' => $zoneData['maxWidth'],
                        'maxHeight' => $zoneData['maxHeight'],
                        'positionX' => $zoneData['positionX'],
                        'positionY' => $zoneData['positionY'],
                        'radius' => $zoneData['radius'],
                        'points' => $zoneData['points'],
                        'isEditable' => $zoneData['isEditable'],
                        'isRequired' => $zoneData['isRequired'],
                        'isBlocked' => $zoneData['isBlocked'],
                        'price' => $zoneData['price'],
                        'sortOrder' => $zoneData['sortOrder'],
                        'isActive' => $zoneData['isActive'],
                    ]
                );
            }
        }

        $this->command?->info('Catálogo inicial de producción cargado.');
    }

    /**
     * @param  array<string, int|string>  $idsByKey
     */
    private function requireId(array $idsByKey, string $key, string $label): int
    {
        if (! array_key_exists($key, $idsByKey)) {
            throw new RuntimeException("No se encontró {$label} '{$key}' requerido por el catálogo inicial.");
        }

        return (int) $idsByKey[$key];
    }
}
