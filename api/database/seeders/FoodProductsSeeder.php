<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductType;
use Illuminate\Database\Seeder;

/**
 * Productos de comida (categoría "Comida" / tipo "Comida rápida").
 *
 * Idempotente: usa updateOrCreate por slug, así que se puede correr varias
 * veces sin duplicar. Las picadas tienen una versión "Combo" que cuesta
 * $2.000 más que la versión base.
 */
class FoodProductsSeeder extends Seeder
{
    public function run(): void
    {
        // Asegura categoría y tipo (idempotente): funciona también en BD nueva.
        $category = Category::updateOrCreate(
            ['slug' => 'comida'],
            ['name' => 'Comida', 'description' => 'Comida y comida rápida', 'isActive' => true]
        );
        $type = ProductType::updateOrCreate(
            ['slug' => 'rapida'],
            ['name' => 'Comida rápida', 'description' => 'Comida rápida', 'categoryId' => $category->id, 'isActive' => true]
        );

        // [slug, nombre, descripción, precio, sku]
        $products = [
            ['perro', 'Perro', 'Perro caliente.', 6000, 'RAP-PERRO'],
            ['combo-perro', 'Combo Perro', 'Combo de perro caliente.', 12000, 'RAP-COMBO-PERRO'],

            ['picada-patacon-pequena', 'Picada Patacón Pequeña', 'Picada de patacón, porción pequeña.', 6000, 'RAP-PICADA-P'],
            ['picada-patacon-mediana', 'Picada Patacón Mediana', 'Picada de patacón, porción mediana.', 8000, 'RAP-PICADA-M'],
            ['picada-patacon-grande', 'Picada Patacón Grande', 'Picada de patacón, porción grande.', 10000, 'RAP-PICADA-G'],

            ['picada-patacon-pequena-combo', 'Picada Patacón Pequeña Combo', 'Picada de patacón pequeña en combo (+$2.000).', 8000, 'RAP-PICADA-P-COMBO'],
            ['picada-patacon-mediana-combo', 'Picada Patacón Mediana Combo', 'Picada de patacón mediana en combo (+$2.000).', 10000, 'RAP-PICADA-M-COMBO'],
            ['picada-patacon-grande-combo', 'Picada Patacón Grande Combo', 'Picada de patacón grande en combo (+$2.000).', 12000, 'RAP-PICADA-G-COMBO'],
        ];

        foreach ($products as [$slug, $name, $description, $price, $sku]) {
            Product::updateOrCreate(
                ['slug' => $slug],
                [
                    'sku' => $sku,
                    'name' => $name,
                    'description' => $description,
                    'categoryId' => $category->id,
                    'typeId' => $type->id,
                    'basePrice' => $price,
                    'stock' => 100,
                    'featured' => false,
                    'isActive' => true,
                    'isTemplate' => false,
                    'images' => ['front' => '', 'back' => '', 'side' => ''],
                    'tags' => [],
                ]
            );
        }

        $this->command?->info('FoodProductsSeeder: '.count($products).' productos de comida sembrados.');
    }
}
