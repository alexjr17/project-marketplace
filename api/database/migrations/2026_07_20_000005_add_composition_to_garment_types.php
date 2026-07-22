<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Composición del tipo de prenda: define si la prenda es individual
     * (SUPERIOR o INFERIOR) o un conjunto (SET = superior + inferior).
     * La referencia hereda esto para saber qué componentes lleva.
     */
    public function up(): void
    {
        Schema::table('mfg_garment_types', function (Blueprint $table) {
            $table->string('composition')->default('SUPERIOR')->after('name'); // SUPERIOR | INFERIOR | SET
        });
    }

    public function down(): void
    {
        Schema::table('mfg_garment_types', function (Blueprint $table) {
            $table->dropColumn('composition');
        });
    }
};
