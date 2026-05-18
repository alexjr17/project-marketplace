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
        // ---- Categorías ----
        $categories = [
            ['name' => 'Suéteres', 'slug' => 'sueteres', 'description' => 'Suéteres y busos personalizables para dama'],
            ['name' => 'Blusas', 'slug' => 'blusas', 'description' => 'Blusas y blusones personalizables para dama'],
        ];
        foreach ($categories as $cat) {
            Category::updateOrCreate(['slug' => $cat['slug']], $cat + ['isActive' => true]);
        }

        // ---- Tallas ---- (Única es la principal; S–XL quedan listas para crecer)
        $sizes = [
            ['name' => 'Talla Única', 'abbreviation' => 'U', 'sortOrder' => 1],
            ['name' => 'Small', 'abbreviation' => 'S', 'sortOrder' => 2],
            ['name' => 'Medium', 'abbreviation' => 'M', 'sortOrder' => 3],
            ['name' => 'Large', 'abbreviation' => 'L', 'sortOrder' => 4],
            ['name' => 'Extra Large', 'abbreviation' => 'XL', 'sortOrder' => 5],
        ];
        foreach ($sizes as $size) {
            Size::updateOrCreate(['abbreviation' => $size['abbreviation']], $size + ['isActive' => true]);
        }

        // ---- Colores ---- (gama típica de prendas para sublimar/estampar)
        $colors = [
            ['name' => 'Blanco', 'slug' => 'blanco', 'hexCode' => '#FFFFFF'],
            ['name' => 'Negro', 'slug' => 'negro', 'hexCode' => '#1A1A1A'],
            ['name' => 'Gris Jaspe', 'slug' => 'gris-jaspe', 'hexCode' => '#9CA3AF'],
            ['name' => 'Beige', 'slug' => 'beige', 'hexCode' => '#D9C9A8'],
            ['name' => 'Azul Marino', 'slug' => 'azul-marino', 'hexCode' => '#1E3A5F'],
            ['name' => 'Vinotinto', 'slug' => 'vinotinto', 'hexCode' => '#6B1F2E'],
            ['name' => 'Verde Militar', 'slug' => 'verde-militar', 'hexCode' => '#4B5320'],
            ['name' => 'Rosa Palo', 'slug' => 'rosa-palo', 'hexCode' => '#E8C4C4'],
        ];
        foreach ($colors as $color) {
            Color::updateOrCreate(['slug' => $color['slug']], $color + ['isActive' => true]);
        }

        // ---- Tipos de producto + tallas asociadas ----
        $types = [
            ['name' => 'Suéter Básico', 'slug' => 'sueter-basico', 'category' => 'sueteres',
                'description' => 'Suéter de corte clásico para dama', 'sizes' => ['U', 'S', 'M', 'L', 'XL']],
            ['name' => 'Suéter Oversize', 'slug' => 'sueter-oversize', 'category' => 'sueteres',
                'description' => 'Suéter de corte holgado para dama', 'sizes' => ['U', 'S', 'M', 'L', 'XL']],
            ['name' => 'Buso', 'slug' => 'buso', 'category' => 'sueteres',
                'description' => 'Buso/sudadera para dama', 'sizes' => ['U', 'S', 'M', 'L', 'XL']],
            ['name' => 'Blusón', 'slug' => 'bluson', 'category' => 'blusas',
                'description' => 'Blusón holgado para dama en talla única', 'sizes' => ['U']],
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
        ];
        foreach ($zoneTypes as $zt) {
            ZoneType::updateOrCreate(['slug' => $zt['slug']], $zt + ['isActive' => true]);
        }
    }
}
