<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cada talla se define para un mercado: Nacional o Exportación.
     * (En el tipo de prenda se listan por mercado para elegir.)
     */
    public function up(): void
    {
        Schema::table('mfg_sizes', function (Blueprint $table) {
            $table->string('market')->default('NATIONAL')->after('abbreviation'); // NATIONAL | EXPORT
        });
    }

    public function down(): void
    {
        Schema::table('mfg_sizes', function (Blueprint $table) {
            $table->dropColumn('market');
        });
    }
};
