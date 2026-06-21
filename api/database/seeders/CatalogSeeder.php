<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Color;
use App\Models\ProductType;
use App\Models\ProductTypeSize;
use App\Models\Size;
use App\Models\ZoneType;
use Illuminate\Database\Seeder;

/**
 * Catálogo base del negocio: una tienda de personalización de prendas
 * para dama (suéteres, busos y blusones). Datos mínimos para arrancar.
 */
class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        // ---- Categorías ---- (relevantes para una tienda de prendas personalizables)
        $categories = [
            ['name' => 'Suéteres', 'slug' => 'sueteres', 'description' => 'Suéteres personalizables'],
            ['name' => 'Busos y Hoodies', 'slug' => 'busos', 'description' => 'Busos, sudaderas y hoodies personalizables'],
            ['name' => 'Camisetas', 'slug' => 'camisetas', 'description' => 'Camisetas para estampado y sublimación'],
            ['name' => 'Blusas', 'slug' => 'blusas', 'description' => 'Blusas y blusones personalizables'],
            ['name' => 'Accesorios', 'slug' => 'accesorios', 'description' => 'Gorras, tote bags y otros accesorios'],
        ];
        foreach ($categories as $cat) {
            Category::updateOrCreate(['slug' => $cat['slug']], $cat + ['isActive' => true]);
        }

        // ---- Tallas ----
        $sizes = [
            ['name' => 'Talla Única', 'abbreviation' => 'U', 'sortOrder' => 1],
            ['name' => 'Extra Small', 'abbreviation' => 'XS', 'sortOrder' => 2],
            ['name' => 'Small', 'abbreviation' => 'S', 'sortOrder' => 3],
            ['name' => 'Medium', 'abbreviation' => 'M', 'sortOrder' => 4],
            ['name' => 'Large', 'abbreviation' => 'L', 'sortOrder' => 5],
            ['name' => 'Extra Large', 'abbreviation' => 'XL', 'sortOrder' => 6],
            ['name' => 'Doble Extra Large', 'abbreviation' => 'XXL', 'sortOrder' => 7],
        ];
        foreach ($sizes as $size) {
            Size::updateOrCreate(['abbreviation' => $size['abbreviation']], $size + ['isActive' => true]);
        }

        // ---- Colores ---- (paleta real para sublimar/estampar)
        $colors = [
            ['name' => 'Blanco', 'slug' => 'blanco', 'hexCode' => '#FFFFFF'],
            ['name' => 'Negro', 'slug' => 'negro', 'hexCode' => '#1A1A1A'],
            ['name' => 'Gris Jaspe', 'slug' => 'gris-jaspe', 'hexCode' => '#9CA3AF'],
            ['name' => 'Gris Oxford', 'slug' => 'gris-oxford', 'hexCode' => '#4B5563'],
            ['name' => 'Beige', 'slug' => 'beige', 'hexCode' => '#D9C9A8'],
            ['name' => 'Azul Marino', 'slug' => 'azul-marino', 'hexCode' => '#1E3A5F'],
            ['name' => 'Azul Rey', 'slug' => 'azul-rey', 'hexCode' => '#1D4ED8'],
            ['name' => 'Celeste', 'slug' => 'celeste', 'hexCode' => '#7DD3FC'],
            ['name' => 'Rojo', 'slug' => 'rojo', 'hexCode' => '#DC2626'],
            ['name' => 'Vinotinto', 'slug' => 'vinotinto', 'hexCode' => '#6B1F2E'],
            ['name' => 'Verde Militar', 'slug' => 'verde-militar', 'hexCode' => '#4B5320'],
            ['name' => 'Verde Botella', 'slug' => 'verde-botella', 'hexCode' => '#14532D'],
            ['name' => 'Rosa Palo', 'slug' => 'rosa-palo', 'hexCode' => '#E8C4C4'],
            ['name' => 'Fucsia', 'slug' => 'fucsia', 'hexCode' => '#DB2777'],
            ['name' => 'Mostaza', 'slug' => 'mostaza', 'hexCode' => '#D4A017'],
            ['name' => 'Lila', 'slug' => 'lila', 'hexCode' => '#C4B5FD'],
        ];
        foreach ($colors as $color) {
            Color::updateOrCreate(['slug' => $color['slug']], $color + ['isActive' => true]);
        }

        // ---- Tipos de producto + tallas asociadas ----
        $types = [
            ['name' => 'Suéter Básico', 'slug' => 'sueter-basico', 'category' => 'sueteres',
                'description' => 'Suéter de corte clásico', 'sizes' => ['U', 'S', 'M', 'L', 'XL']],
            ['name' => 'Suéter Oversize', 'slug' => 'sueter-oversize', 'category' => 'sueteres',
                'description' => 'Suéter de corte holgado', 'sizes' => ['U', 'S', 'M', 'L', 'XL']],
            ['name' => 'Buso', 'slug' => 'buso', 'category' => 'busos',
                'description' => 'Buso/sudadera cuello redondo', 'sizes' => ['S', 'M', 'L', 'XL', 'XXL']],
            ['name' => 'Hoodie', 'slug' => 'hoodie', 'category' => 'busos',
                'description' => 'Buso con capota (hoodie)', 'sizes' => ['S', 'M', 'L', 'XL', 'XXL']],
            ['name' => 'Camiseta', 'slug' => 'camiseta', 'category' => 'camisetas',
                'description' => 'Camiseta cuello redondo para estampado/sublimación', 'sizes' => ['XS', 'S', 'M', 'L', 'XL', 'XXL']],
            ['name' => 'Blusón', 'slug' => 'bluson', 'category' => 'blusas',
                'description' => 'Blusón holgado en talla única', 'sizes' => ['U']],
            ['name' => 'Tote Bag', 'slug' => 'tote-bag', 'category' => 'accesorios',
                'description' => 'Bolso tote de lienzo', 'sizes' => ['U']],
            ['name' => 'Gorra', 'slug' => 'gorra', 'category' => 'accesorios',
                'description' => 'Gorra ajustable para bordado/estampado', 'sizes' => ['U']],
        ];
        foreach ($types as $type) {
            $category = Category::where('slug', $type['category'])->first();
            $productType = ProductType::updateOrCreate(
                ['slug' => $type['slug']],
                [
                    'name' => $type['name'],
                    'description' => $type['description'],
                    'categoryId' => $category?->id,
                    'isActive' => true,
                ]
            );

            foreach ($type['sizes'] as $abbr) {
                $size = Size::where('abbreviation', $abbr)->first();
                if ($size) {
                    ProductTypeSize::updateOrCreate([
                        'productTypeId' => $productType->id,
                        'sizeId' => $size->id,
                    ]);
                }
            }
        }

        // ---- Tipos de zona (áreas personalizables del producto modelo) ----
        $zoneTypes = [
            ['name' => 'Frente', 'slug' => 'frente', 'description' => 'Zona frontal de la prenda', 'sortOrder' => 1],
            ['name' => 'Espalda', 'slug' => 'espalda', 'description' => 'Zona trasera de la prenda', 'sortOrder' => 2],
            ['name' => 'Manga Izquierda', 'slug' => 'manga-izquierda', 'description' => 'Manga izquierda', 'sortOrder' => 3],
            ['name' => 'Manga Derecha', 'slug' => 'manga-derecha', 'description' => 'Manga derecha', 'sortOrder' => 4],
            ['name' => 'Bolsillo', 'slug' => 'bolsillo', 'description' => 'Zona del bolsillo (logo pequeño)', 'sortOrder' => 5],
        ];
        foreach ($zoneTypes as $zt) {
            ZoneType::updateOrCreate(['slug' => $zt['slug']], $zt + ['isActive' => true]);
        }
    }
}
