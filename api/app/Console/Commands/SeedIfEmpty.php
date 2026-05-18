<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

/**
 * Siembra la base de datos SOLO si está vacía.
 * Pensado para hosts sin acceso a shell (Render free): el primer despliegue
 * siembra los datos; los reinicios posteriores no tocan nada.
 */
class SeedIfEmpty extends Command
{
    protected $signature = 'app:seed-if-empty';

    protected $description = 'Siembra los datos iniciales solo si la base de datos está vacía.';

    public function handle(): int
    {
        try {
            if (User::count() > 0) {
                $this->info('La base de datos ya tiene datos — no se siembra.');

                return self::SUCCESS;
            }
        } catch (\Throwable $e) {
            // La tabla aún no existe: se continúa para sembrar.
        }

        $this->info('Base de datos vacía — sembrando datos iniciales...');
        $this->call('db:seed', ['--force' => true]);

        return self::SUCCESS;
    }
}
