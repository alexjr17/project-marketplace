<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Color;
use App\Models\ProductType;
use App\Models\ProductTypeSize;
use App\Models\Size;
use Illuminate\Database\Seeder;

class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        // Categorías
        $categories = [
            ['name' => 'Ropa', 'slug' => 'ropa', 'description' => 'Camisetas, hoodies, buzos y prendas sublimables'],
            ['name' => 'Bebidas', 'slug' => 'bebidas', 'description' => 'Tazas, termos, vasos y recipientes sublimables'],
            ['name' => 'Hogar', 'slug' => 'hogar', 'description' => 'Decoración y artículos para el hogar'],
            ['name' => 'Accesorios', 'slug' => 'accesorios', 'description' => 'Gorras, llaveros, fundas y más'],
            ['name' => 'Oficina', 'slug' => 'oficina', 'description' => 'Artículos de oficina personalizables'],
        ];
        foreach ($categories as $cat) {
            Category::updateOrCreate(['slug' => $cat['slug']], $cat + ['isActive' => true]);
        }

        // Tallas
        $sizes = [
            ['name' => 'Extra Small', 'abbreviation' => 'XS', 'sortOrder' => 1],
            ['name' => 'Small', 'abbreviation' => 'S', 'sortOrder' => 2],
            ['name' => 'Medium', 'abbreviation' => 'M', 'sortOrder' => 3],
            ['name' => 'Large', 'abbreviation' => 'L', 'sortOrder' => 4],
            ['name' => 'Extra Large', 'abbreviation' => 'XL', 'sortOrder' => 5],
            ['name' => 'Extra Extra Large', 'abbreviation' => 'XXL', 'sortOrder' => 6],
            ['name' => 'Talla Única', 'abbreviation' => 'Unica', 'sortOrder' => 7],
            ['name' => '11 onzas', 'abbreviation' => '11oz', 'sortOrder' => 20],
            ['name' => '15 onzas', 'abbreviation' => '15oz', 'sortOrder' => 21],
            ['name' => '20 onzas', 'abbreviation' => '20oz', 'sortOrder' => 22],
        ];
        foreach ($sizes as $size) {
            Size::updateOrCreate(['abbreviation' => $size['abbreviation']], $size + ['isActive' => true]);
        }

        // Colores
        $colors = [
            ['name' => 'Negro', 'slug' => 'negro', 'hexCode' => '#000000'],
            ['name' => 'Blanco', 'slug' => 'blanco', 'hexCode' => '#FFFFFF'],
            ['name' => 'Gris', 'slug' => 'gris', 'hexCode' => '#9CA3AF'],
            ['name' => 'Azul', 'slug' => 'azul', 'hexCode' => '#2563EB'],
            ['name' => 'Rojo', 'slug' => 'rojo', 'hexCode' => '#DC2626'],
            ['name' => 'Verde', 'slug' => 'verde', 'hexCode' => '#16A34A'],
        ];
        foreach ($colors as $color) {
            Color::updateOrCreate(['slug' => $color['slug']], $color + ['isActive' => true]);
        }

        // Tipos de producto + sus tallas
        $types = [
            ['name' => 'Suéter', 'slug' => 'sueter', 'description' => 'Suéteres personalizables', 'category' => 'ropa', 'sizes' => ['M', 'L', 'XL']],
            ['name' => 'Blusa', 'slug' => 'blusa', 'description' => 'Blusas personalizables', 'category' => 'ropa', 'sizes' => ['Unica']],
            ['name' => 'Taza', 'slug' => 'taza', 'description' => 'Tazas de cerámica', 'category' => 'bebidas', 'sizes' => ['11oz', '15oz', '20oz']],
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
    }
}
