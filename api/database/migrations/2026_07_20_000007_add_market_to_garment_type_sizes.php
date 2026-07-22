<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Las tallas del tipo de prenda se clasifican por mercado (Nacional /
     * Exportación), como en project-fabrica-ropa. Una talla puede existir en
     * ambos mercados, por eso el único es (garmentTypeId, sizeId, market).
     */
    public function up(): void
    {
        // La FK de garmentTypeId usa el único compuesto; dale un índice propio antes de soltarlo.
        Schema::table('mfg_garment_type_sizes', function (Blueprint $table) {
            $table->index('garmentTypeId', 'mfg_gts_gtid_idx');
        });
        Schema::table('mfg_garment_type_sizes', function (Blueprint $table) {
            $table->dropUnique('mfg_gts_type_size_unique');
            $table->string('market')->default('NATIONAL')->after('sizeId'); // NATIONAL | EXPORT
            $table->unique(['garmentTypeId', 'sizeId', 'market'], 'mfg_gts_type_size_market_unique');
        });
    }

    public function down(): void
    {
        Schema::table('mfg_garment_type_sizes', function (Blueprint $table) {
            $table->dropUnique('mfg_gts_type_size_market_unique');
            $table->dropColumn('market');
            $table->unique(['garmentTypeId', 'sizeId'], 'mfg_gts_type_size_unique');
            $table->dropIndex('mfg_gts_gtid_idx');
        });
    }
};
