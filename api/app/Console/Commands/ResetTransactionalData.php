<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\VariantService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Limpia los datos transaccionales para iniciar producción desde cero:
 * ventas/fiados, compras e inventario, clientes POS y sesiones de caja.
 * Además deja todos los productos como SIMPLES (sin variantes de color/talla)
 * y con stock 0. NO toca: productos, catálogo, usuarios, roles ni configuración.
 *
 * Uso (producción): php artisan data:reset-transactional --force
 */
class ResetTransactionalData extends Command
{
    protected $signature = 'data:reset-transactional {--force : Ejecuta sin pedir confirmación}';

    protected $description = 'Borra ventas, compras, inventario, clientes POS y cajas; deja productos simples con stock 0.';

    public function handle(VariantService $variants): int
    {
        if (! $this->option('force') && ! $this->confirm(
            '⚠️  Esto BORRA ventas/fiados, compras, inventario, clientes POS y cajas (IRREVERSIBLE), '.
            'y deja los productos simples con stock 0. ¿Continuar?'
        )) {
            $this->warn('Cancelado. No se borró nada.');

            return self::SUCCESS;
        }

        // Tablas hijas → padres (respeta llaves foráneas). Se ignoran en silencio
        // las que no existan en este entorno.
        $tablesInOrder = [
            // Ventas / fiados
            'payments', 'order_items', 'variant_movements', 'orders',
            'pos_customers',
            // Compras
            'purchase_return_items', 'purchase_returns',
            'purchase_order_items', 'purchase_orders',
            // Inventario
            'conversion_input_items', 'conversion_output_items', 'inventory_conversions',
            'inventory_count_items', 'inventory_counts',
            'input_batch_movements', 'input_variant_movements', 'input_batches',
            // Cajas
            'cash_sessions',
        ];

        DB::transaction(function () use ($variants, $tablesInOrder) {
            foreach ($tablesInOrder as $table) {
                if (! Schema::hasTable($table)) {
                    continue;
                }
                $count = DB::table($table)->count();
                DB::table($table)->delete();
                $this->line(sprintf('  • %-26s %d filas borradas', $table, $count));
            }

            // Productos → simples (sin color/talla) y stock 0.
            DB::table('product_colors')->delete();
            DB::table('product_sizes')->delete();
            DB::table('products')->update(['stock' => 0]);

            $products = Product::query()->where('isTemplate', false)->get();
            foreach ($products as $product) {
                // Sin productColors/productSizes, esto desactiva las variantes de
                // color/talla y deja/crea una variante simple [null,null].
                $variants->generateVariantsForProduct($product->id, 0);
            }

            // Stock 0 en todas las variantes (incluida la simple).
            ProductVariant::query()->update(['stock' => 0]);

            // Stock de insumos a 0.
            if (Schema::hasTable('input_variants') && Schema::hasColumn('input_variants', 'currentStock')) {
                DB::table('input_variants')->update(['currentStock' => 0]);
            }

            $this->line(sprintf('  • productos puestos como simples: %d (stock 0)', $products->count()));
        });

        $this->info('✅ Listo. Datos transaccionales limpios; productos simples con stock 0.');

        return self::SUCCESS;
    }
}
