<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Costo fijo y factor por defecto del tipo de prenda (como el indicador de
     * costo de `ReferenciaTipo` en project-fabrica-ropa). Al crear una referencia
     * de este tipo, se sugieren estos valores.
     */
    public function up(): void
    {
        Schema::table('mfg_garment_types', function (Blueprint $table) {
            $table->decimal('fixedCost', 12, 2)->default(0)->after('composition');
            $table->decimal('factor', 10, 4)->default(1)->after('fixedCost');
        });
    }

    public function down(): void
    {
        Schema::table('mfg_garment_types', function (Blueprint $table) {
            $table->dropColumn(['fixedCost', 'factor']);
        });
    }
};
