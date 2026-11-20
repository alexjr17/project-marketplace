<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\Setting;
use App\Support\BrandIdentitySettings;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ProductionInitialSeeder extends Seeder
{
    public const MARKER_SETTING = 'productionInitialDataLoaded';

    public function run(): void
    {
        DB::transaction(function (): void {
            if (! Role::query()->exists()) {
                $this->call(RoleSeeder::class);
            }

            $this->call(CatalogSeeder::class);
            BrandIdentitySettings::apply();
            $this->call(ProductionCatalogSeeder::class);

            Setting::updateOrCreate(
                ['key' => self::MARKER_SETTING],
                ['value' => ['seededAt' => now()->toIso8601String()]]
            );
        });

        $this->command?->info('Datos iniciales de producción cargados sin usuarios, compras ni stock.');
    }
}
