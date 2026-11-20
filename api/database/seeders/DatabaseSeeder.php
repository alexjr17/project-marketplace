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
        if (app()->environment('production')) {
            $this->call(ProductionInitialSeeder::class);

            return;
        }

        // Datos demo solo para desarrollo local.
        $this->call([
            RoleSeeder::class,
            UserSeeder::class,
            SettingsSeeder::class,
            ShippingSeeder::class,
            CatalogSeeder::class,    // categorías, tipos, colores, tallas, zonas
            InventorySeeder::class,  // proveedor, tipos de insumo e insumos (materia prima)
            MinimalSeeder::class,    // productos, plantillas, anuncios, descuentos, caja, compra
        ]);
    }
}
