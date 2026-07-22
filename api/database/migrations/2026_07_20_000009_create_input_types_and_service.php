<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tipos de insumo con clasificación Producto/Servicio (como fabrica-ropa).
     *   - PRODUCTO: material que se consume (telas, hilos, botones).
     *   - SERVICIO: mano de obra / proceso (corte, bordado, estampado); no se consume.
     * El insumo pertenece a un tipo y hereda la clasificación. Para servicios se
     * indica el alcance interno/externo.
     */
    public function up(): void
    {
        Schema::create('mfg_input_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('classification')->default('PRODUCTO'); // PRODUCTO | SERVICIO
            $table->text('description')->nullable();
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::table('mfg_inputs', function (Blueprint $table) {
            $table->foreignId('inputTypeId')->nullable()->after('name')
                ->constrained('mfg_input_types')->nullOnDelete();
            $table->string('scope')->nullable()->after('unitOfMeasure'); // solo servicios: INTERNAL | EXTERNAL
        });
    }

    public function down(): void
    {
        Schema::table('mfg_inputs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('inputTypeId');
            $table->dropColumn('scope');
        });
        Schema::dropIfExists('mfg_input_types');
    }
};
