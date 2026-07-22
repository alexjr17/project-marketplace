<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * App "Fábrica" (manufacturing) — versión ligera del módulo de producción.
     *
     * Catálogos PROPIOS (independientes del marketplace): tipos de prenda,
     * colores, tallas e insumos son módulos de la app Fábrica, no se comparten
     * con la tienda. Con estos se arma la Referencia y su ficha técnica.
     *
     * Fase 1:
     *   - mfg_garment_types : tipo de prenda (su código arma el de la referencia).
     *   - mfg_colors / mfg_sizes / mfg_inputs : catálogos base propios.
     *   - mfg_processes / mfg_workshops / mfg_warehouses : configuración de planta.
     *   - mfg_references (+ colors/sizes/materials) : referencia con ficha técnica.
     */
    public function up(): void
    {
        // ---------- Catálogos propios ----------

        // Tipo de prenda. El `code` (p. ej. CAM) prefija el código de la referencia.
        Schema::create('mfg_garment_types', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();      // CAM, HOO, PAN…
            $table->string('name');                // Camiseta, Hoodie…
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        // Colores propios de Fábrica. `code` de 2 dígitos para el código de barras (fase futura).
        Schema::create('mfg_colors', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('hexCode')->default('#000000');
            $table->string('code')->nullable();    // 01, 02… (para el barcode)
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        // Tallas propias de Fábrica.
        Schema::create('mfg_sizes', function (Blueprint $table) {
            $table->id();
            $table->string('name');                // Small, Medium…
            $table->string('abbreviation');        // S, M, L…
            $table->integer('sortOrder')->default(0);
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        // Insumos / materiales propios de Fábrica (catálogo simple, sin contabilidad de stock).
        Schema::create('mfg_inputs', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('unitOfMeasure')->default('und');  // m, kg, und…
            $table->text('notes')->nullable();
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        // ---------- Configuración de planta ----------

        // Estaciones / etapas de producción. El orden define la ruta por defecto.
        Schema::create('mfg_processes', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->nullable()->unique();
            $table->integer('sequence')->default(0);
            $table->string('type')->default('INTERNAL');   // INTERNAL | EXTERNAL (satélite)
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        // Talleres (internos y satélites).
        Schema::create('mfg_workshops', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->nullable()->unique();
            $table->string('type')->default('EXTERNAL');   // INTERNAL | EXTERNAL
            $table->string('contactName')->nullable();
            $table->string('phone')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        // Bodegas.
        Schema::create('mfg_warehouses', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->nullable()->unique();
            $table->string('address')->nullable();
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        // ---------- Referencia + ficha técnica ----------

        Schema::create('mfg_references', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();      // CAM-0001 (auto: tipo + consecutivo)
            $table->string('name');
            $table->foreignId('garmentTypeId')->nullable()->constrained('mfg_garment_types')->nullOnDelete();
            $table->text('description')->nullable();
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::create('mfg_reference_colors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('referenceId')->constrained('mfg_references')->cascadeOnDelete();
            $table->foreignId('colorId')->constrained('mfg_colors')->cascadeOnDelete();
            $table->timestamp('createdAt')->nullable();
            $table->unique(['referenceId', 'colorId']);
        });

        Schema::create('mfg_reference_sizes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('referenceId')->constrained('mfg_references')->cascadeOnDelete();
            $table->foreignId('sizeId')->constrained('mfg_sizes')->cascadeOnDelete();
            $table->timestamp('createdAt')->nullable();
            $table->unique(['referenceId', 'sizeId']);
        });

        // Ficha técnica / BOM: insumos que componen la referencia y su consumo por unidad.
        Schema::create('mfg_reference_materials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('referenceId')->constrained('mfg_references')->cascadeOnDelete();
            $table->foreignId('inputId')->constrained('mfg_inputs')->cascadeOnDelete();
            $table->foreignId('colorId')->nullable()->constrained('mfg_colors')->nullOnDelete();
            $table->decimal('consumption', 12, 4)->default(0);
            $table->string('unitOfMeasure')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mfg_reference_materials');
        Schema::dropIfExists('mfg_reference_sizes');
        Schema::dropIfExists('mfg_reference_colors');
        Schema::dropIfExists('mfg_references');
        Schema::dropIfExists('mfg_warehouses');
        Schema::dropIfExists('mfg_workshops');
        Schema::dropIfExists('mfg_processes');
        Schema::dropIfExists('mfg_inputs');
        Schema::dropIfExists('mfg_sizes');
        Schema::dropIfExists('mfg_colors');
        Schema::dropIfExists('mfg_garment_types');
    }
};
