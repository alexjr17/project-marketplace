<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Desglose de consumo del insumo en la ficha técnica (como project-fabrica-ropa):
     * consumo inicial + incremento (%) → consumo final. `consumption` sigue siendo
     * el consumo final (el que se usa en costos y producción).
     */
    public function up(): void
    {
        Schema::table('mfg_reference_materials', function (Blueprint $table) {
            $table->decimal('consumptionInitial', 12, 4)->nullable()->after('componentId');
            $table->decimal('increment', 8, 2)->default(0)->after('consumptionInitial'); // %
        });
    }

    public function down(): void
    {
        Schema::table('mfg_reference_materials', function (Blueprint $table) {
            $table->dropColumn(['consumptionInitial', 'increment']);
        });
    }
};
