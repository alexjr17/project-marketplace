<?php

namespace App\Console\Commands;

use App\Support\BrandIdentitySettings;
use Illuminate\Console\Command;

/**
 * Synchronizes TOCLEX public identity fields without replacing unrelated settings.
 * Dry-run by default; pass --apply to write the three targeted settings.
 */
class SyncBrandIdentity extends Command
{
    protected $signature = 'brand:sync-identity {--apply : Apply the TOCLEX brand identity to the settings table}';

    protected $description = 'Previews or applies the TOCLEX name, slogan, logos, and colors.';

    public function handle(): int
    {
        $updates = BrandIdentitySettings::definitions();

        if (! $this->option('apply')) {
            $this->info('Modo de vista previa. No se modificó la base de datos.');
            $this->line('Se actualizarían: general_settings, appearance_settings y store_settings.storeName.');
            $this->line('Los demás campos de esos ajustes se conservarán.');
            $this->comment('Para aplicar: php artisan brand:sync-identity --apply');

            return self::SUCCESS;
        }

        BrandIdentitySettings::apply();

        $this->info('Identidad de TOCLEX aplicada. Se conservaron los demás campos de configuración.');

        return self::SUCCESS;
    }
}
