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
        if ($this->shouldFreshSeed()) {
            $this->warn('Limpiando la base de datos y sembrando TODOS los datos por defecto...');
            $this->call('migrate:fresh', ['--force' => true, '--seed' => true]);
            $this->info('Listo: base reiniciada con catálogo, insumos, apariencia y usuarios por defecto.');

            return self::SUCCESS;
        }

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

    /**
     * ¿Hay que limpiar y resembrar desde cero?
     *  - Si FRESH_SEED está activo (forzado por variable de entorno), o
     *  - Una sola vez automáticamente: mientras siga existiendo el usuario demo
     *    ANTIGUO (admin@marketplace.com). Tras el reseed ese usuario desaparece,
     *    así que el reinicio siguiente ya NO vuelve a borrar la base.
     */
    private function shouldFreshSeed(): bool
    {
        if (filter_var(getenv('FRESH_SEED'), FILTER_VALIDATE_BOOLEAN)) {
            return true;
        }

        try {
            return User::where('email', 'admin@marketplace.com')->exists();
        } catch (\Throwable $e) {
            // La tabla aún no existe (BD nueva): no hace falta limpiar.
            return false;
        }
    }
}
