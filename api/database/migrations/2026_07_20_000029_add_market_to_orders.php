<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tipo de mercado (Nacional / Exportación) en pedido y orden de producción,
     * como `tipo_mercado` de project-fabrica-ropa. Define qué tallas (por mercado)
     * aplican a la matriz.
     */
    public function up(): void
    {
        Schema::table('mfg_purchase_orders', function (Blueprint $table) {
            $table->string('market')->default('NATIONAL')->after('semester'); // NATIONAL | EXPORT
        });
        Schema::table('mfg_production_orders', function (Blueprint $table) {
            $table->string('market')->default('NATIONAL')->after('semester');
        });
    }

    public function down(): void
    {
        Schema::table('mfg_purchase_orders', function (Blueprint $table) {
            $table->dropColumn('market');
        });
        Schema::table('mfg_production_orders', function (Blueprint $table) {
            $table->dropColumn('market');
        });
    }
};
