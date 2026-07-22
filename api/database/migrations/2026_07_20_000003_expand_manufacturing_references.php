<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Expande la Referencia para replicar la ficha técnica de project-fabrica-ropa:
     *   - Imagen, colores con tipo (primario/secundario).
     *   - Componentes (SUPERIOR/INFERIOR) y asignación de materiales a componentes.
     *   - Materiales con valor unitario (para el costo variable).
     *   - Costos: costo_fijo + factor en la referencia (costo_variable/unitario/precio_base calculados).
     *   - Grupos de tallas (listas de precio): mercado, costo fijo adicional, factor,
     *     precio_lista, mayorista, con sus tallas y recargo por color.
     */
    public function up(): void
    {
        // --- Referencia: imagen + costos de cabecera ---
        Schema::table('mfg_references', function (Blueprint $table) {
            $table->string('imagePath')->nullable()->after('name');   // URL de la imagen
            $table->decimal('fixedCost', 12, 2)->default(0);          // costo_fijo
            $table->decimal('factor', 10, 4)->default(1);             // factor principal
            $table->decimal('costVariable', 12, 2)->default(0);       // Σ (consumo × valor) insumos
            $table->decimal('costUnit', 12, 2)->default(0);           // costVariable + fixedCost
            $table->decimal('basePrice', 12, 2)->default(0);          // costUnit × factor
        });

        // --- Colores: tipo primario/secundario ---
        Schema::table('mfg_reference_colors', function (Blueprint $table) {
            $table->string('colorType')->default('SECONDARY')->after('colorId'); // PRIMARY | SECONDARY
        });

        // --- Componentes de la referencia (SUPERIOR/INFERIOR) ---
        Schema::create('mfg_reference_components', function (Blueprint $table) {
            $table->id();
            $table->foreignId('referenceId')->constrained('mfg_references')->cascadeOnDelete();
            $table->string('position')->default('SUPERIOR'); // SUPERIOR | INFERIOR
            $table->string('description')->nullable();
            $table->timestamp('createdAt')->nullable();
        });

        // --- Materiales: valor unitario + componente ---
        Schema::table('mfg_reference_materials', function (Blueprint $table) {
            $table->decimal('unitValue', 12, 4)->default(0)->after('consumption'); // costo unitario del insumo
            $table->foreignId('componentId')->nullable()->after('colorId')
                ->constrained('mfg_reference_components')->nullOnDelete();
        });

        // --- Grupos de tallas (listas de precio) ---
        Schema::create('mfg_size_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('referenceId')->constrained('mfg_references')->cascadeOnDelete();
            $table->string('name');
            $table->string('market')->default('NATIONAL');           // NATIONAL | EXPORT
            $table->decimal('fixedCostExtra', 12, 2)->default(0);    // costo fijo adicional del grupo
            $table->decimal('factor', 10, 4)->default(1);            // factor del grupo
            $table->decimal('listPrice', 12, 2)->default(0);         // precio de lista (auto o manual)
            $table->boolean('isWholesale')->default(false);          // mayorista / retail
            $table->integer('sortOrder')->default(0);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::create('mfg_size_group_sizes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sizeGroupId')->constrained('mfg_size_groups')->cascadeOnDelete();
            $table->foreignId('sizeId')->constrained('mfg_sizes')->cascadeOnDelete();
            $table->timestamp('createdAt')->nullable();
            $table->unique(['sizeGroupId', 'sizeId'], 'mfg_sgs_group_size_unique');
        });

        // Recargo por color dentro de un grupo de tallas (se suma en la venta).
        Schema::create('mfg_size_group_surcharges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sizeGroupId')->constrained('mfg_size_groups')->cascadeOnDelete();
            $table->foreignId('colorId')->constrained('mfg_colors')->cascadeOnDelete();
            $table->decimal('amount', 12, 2)->default(0);
            $table->timestamp('createdAt')->nullable();
            $table->unique(['sizeGroupId', 'colorId'], 'mfg_sgsur_group_color_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mfg_size_group_surcharges');
        Schema::dropIfExists('mfg_size_group_sizes');
        Schema::dropIfExists('mfg_size_groups');

        Schema::table('mfg_reference_materials', function (Blueprint $table) {
            $table->dropConstrainedForeignId('componentId');
            $table->dropColumn('unitValue');
        });
        Schema::dropIfExists('mfg_reference_components');

        Schema::table('mfg_reference_colors', function (Blueprint $table) {
            $table->dropColumn('colorType');
        });

        Schema::table('mfg_references', function (Blueprint $table) {
            $table->dropColumn(['imagePath', 'fixedCost', 'factor', 'costVariable', 'costUnit', 'basePrice']);
        });
    }
};
