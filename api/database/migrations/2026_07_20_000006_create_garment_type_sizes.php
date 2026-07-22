<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tallas por tipo de prenda. Cada tipo de prenda define su set de tallas;
     * al crear una referencia de ese tipo, se traen esas tallas por defecto
     * (equivale a las tallas por categoría de project-fabrica-ropa).
     */
    public function up(): void
    {
        Schema::create('mfg_garment_type_sizes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('garmentTypeId')->constrained('mfg_garment_types')->cascadeOnDelete();
            $table->foreignId('sizeId')->constrained('mfg_sizes')->cascadeOnDelete();
            $table->unique(['garmentTypeId', 'sizeId'], 'mfg_gts_type_size_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mfg_garment_type_sizes');
    }
};
