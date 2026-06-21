<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Versión del set de datos por defecto. Al cambiarla (cuando se ajustan los
     * seeders), el siguiente deploy limpia y resiembra automáticamente (una vez).
     */
    public const SEED_VERSION = '2026-06-22.5';

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
            CatalogSeeder::class,    // categorías, tipos, colores, tallas, zonas
            InventorySeeder::class,  // proveedor, tipos de insumo e insumos (materia prima)
            MinimalSeeder::class,    // productos, plantillas, anuncios, descuentos, caja, compra
        ]);

        // Marca la versión sembrada (la usa app:seed-if-empty para auto-resembrar).
        Setting::updateOrCreate(['key' => 'seedVersion'], ['value' => ['v' => self::SEED_VERSION]]);
    }
}
