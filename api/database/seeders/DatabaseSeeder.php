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
        // Set mínimo de arranque (demo limpia). Los seeders pesados de ejemplo
        // (inventario, compras, comida, mensajería, bot) siguen existiendo pero
        // fuera del seed por defecto.
        $this->call([
            RoleSeeder::class,
            UserSeeder::class,
            SettingsSeeder::class,
            ShippingSeeder::class,
            CatalogSeeder::class,   // categorías, tipos, colores, tallas, zonas
            MinimalSeeder::class,   // productos, plantillas, anuncios, descuentos, caja
        ]);
    }
}
