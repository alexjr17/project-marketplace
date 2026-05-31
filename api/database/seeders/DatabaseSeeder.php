<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Datos iniciales de la aplicación.
     */
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            UserSeeder::class,
            CatalogSeeder::class,
            InventorySeeder::class,
            CommerceSeeder::class,
            FoodProductsSeeder::class,
            PurchaseSeeder::class,
            SettingsSeeder::class,
            ShippingSeeder::class,
            MessagingSeeder::class,
            BotKnowledgeCategorySeeder::class, // categorías primero
            BotKnowledgeSeeder::class,
        ]);
    }
}
