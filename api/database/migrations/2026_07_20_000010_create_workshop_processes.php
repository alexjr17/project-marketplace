<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Procesos que hace cada taller (N:N), como `EstacionExternaEstacionProduccion`
     * de project-fabrica-ropa. Sirve para, al asignar un taller a una etapa de
     * producción, ofrecer solo los talleres que hacen ese proceso.
     */
    public function up(): void
    {
        Schema::create('mfg_workshop_processes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workshopId')->constrained('mfg_workshops')->cascadeOnDelete();
            $table->foreignId('processId')->constrained('mfg_processes')->cascadeOnDelete();
            $table->unique(['workshopId', 'processId'], 'mfg_wp_workshop_process_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mfg_workshop_processes');
    }
};
