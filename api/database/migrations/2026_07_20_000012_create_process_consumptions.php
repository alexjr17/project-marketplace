<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Configuración de qué insumos consume cada proceso (como
     * `EstacionProduccionConsumo` de project-fabrica-ropa): por CATEGORÍA
     * (tipo de insumo) o por INSUMO específico.
     */
    public function up(): void
    {
        Schema::create('mfg_process_consumptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('processId')->constrained('mfg_processes')->cascadeOnDelete();
            $table->string('kind');                    // TYPE (por tipo de insumo) | INPUT (insumo específico)
            $table->foreignId('inputTypeId')->nullable()->constrained('mfg_input_types')->cascadeOnDelete();
            $table->foreignId('inputId')->nullable()->constrained('mfg_inputs')->cascadeOnDelete();
            $table->timestamp('createdAt')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mfg_process_consumptions');
    }
};
