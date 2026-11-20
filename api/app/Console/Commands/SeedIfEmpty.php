<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Models\User;
use Database\Seeders\ProductionInitialSeeder;
use Illuminate\Console\Command;

/**
 * Siembra el catálogo productivo una sola vez, sin reiniciar la base de datos.
 * En desarrollo conserva el seed demo únicamente para una base sin usuarios.
 */
class SeedIfEmpty extends Command
{
    protected $signature = 'app:seed-if-empty';

    protected $description = 'Siembra los datos iniciales sin reiniciar la base de datos.';

    public function handle(): int
    {
        if ($this->laravel->environment('production')) {
            if (Setting::where('key', ProductionInitialSeeder::MARKER_SETTING)->exists()) {
                $this->info('Los datos iniciales de producción ya están cargados.');

                return self::SUCCESS;
            }

            $this->info('Cargando catálogo inicial de producción sin modificar usuarios ni inventario existente...');

            return $this->call('db:seed', ['--force' => true]);
        }

        if (User::query()->exists()) {
            $this->info('La base de datos ya tiene usuarios — no se siembra.');

            return self::SUCCESS;
        }

        $this->info('Base de datos vacía — sembrando datos iniciales...');

        return $this->call('db:seed', ['--force' => true]);
    }
}
