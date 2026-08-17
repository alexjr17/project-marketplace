<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Factor de exportación del tipo de prenda (además del `factor` nacional).
     * Como los factores por mercado del indicador de costo de fabrica: al crear
     * un grupo de tallas se sugiere el factor del mercado correspondiente.
     */
    public function up(): void
    {
        Schema::table('mfg_garment_types', function (Blueprint $table) {
            $table->decimal('factorExport', 10, 4)->default(1)->after('factor');
        });
    }

    public function down(): void
    {
        Schema::table('mfg_garment_types', function (Blueprint $table) {
            $table->dropColumn('factorExport');
        });
    }
};
