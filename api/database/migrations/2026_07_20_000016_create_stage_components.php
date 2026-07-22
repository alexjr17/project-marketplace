<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Taller asignado a cada COMPONENTE de la prenda dentro de una etapa
     * (equivalente a `EtapaComponente` de project-fabrica-ropa). Cada componente
     * (SUPERIOR/INFERIOR) de la referencia puede mandarse a un taller distinto en
     * una etapa externa; el reporte de la etapa se genera por componente.
     */
    public function up(): void
    {
        Schema::create('mfg_stage_components', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stageId')->constrained('mfg_production_order_stages')->cascadeOnDelete();
            $table->foreignId('componentId')->constrained('mfg_reference_components')->cascadeOnDelete();
            $table->foreignId('workshopId')->nullable()->constrained('mfg_workshops')->nullOnDelete();
            $table->unique(['stageId', 'componentId'], 'mfg_sc_stage_component_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mfg_stage_components');
    }
};
