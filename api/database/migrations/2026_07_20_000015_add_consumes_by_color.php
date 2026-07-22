<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Marca los tipos de insumo que se consumen POR COLOR (como las telas):
     * el consumo se calcula por cada color de la orden, y la sustitución se hace
     * por (insumo, color). Los demás tipos consumen por total.
     */
    public function up(): void
    {
        Schema::table('mfg_input_types', function (Blueprint $table) {
            $table->boolean('consumesByColor')->default(false)->after('classification');
        });
    }

    public function down(): void
    {
        Schema::table('mfg_input_types', function (Blueprint $table) {
            $table->dropColumn('consumesByColor');
        });
    }
};
