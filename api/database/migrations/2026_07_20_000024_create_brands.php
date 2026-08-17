<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Marcas de la app Fábrica (como `Marca`/`id_marca` de project-fabrica-ropa,
     * eje transversal). Catálogo propio; la referencia y el tipo de prenda
     * pueden llevar marca.
     */
    public function up(): void
    {
        Schema::create('mfg_brands', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->nullable();
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::table('mfg_references', function (Blueprint $table) {
            $table->foreignId('brandId')->nullable()->after('garmentTypeId')
                ->constrained('mfg_brands')->nullOnDelete();
        });
        Schema::table('mfg_garment_types', function (Blueprint $table) {
            $table->foreignId('brandId')->nullable()->after('code')
                ->constrained('mfg_brands')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('mfg_references', function (Blueprint $table) {
            $table->dropConstrainedForeignId('brandId');
        });
        Schema::table('mfg_garment_types', function (Blueprint $table) {
            $table->dropConstrainedForeignId('brandId');
        });
        Schema::dropIfExists('mfg_brands');
    }
};
