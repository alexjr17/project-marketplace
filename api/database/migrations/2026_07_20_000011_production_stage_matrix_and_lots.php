<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Núcleo de producción tipo project-fabrica-ropa:
     *   - mfg_production_stage_cells : matriz de cantidades COMPLETADAS por etapa
     *     (color×talla). La programada de cada etapa se deriva por cascada
     *     (etapa 1 = matriz de la orden; siguientes = completadas de la anterior).
     *   - trazabilidad y encargado en la etapa.
     *   - mfg_lots / mfg_lot_items : lote de producto terminado creado al cerrar.
     */
    public function up(): void
    {
        Schema::create('mfg_production_stage_cells', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stageId')->constrained('mfg_production_order_stages')->cascadeOnDelete();
            $table->foreignId('colorId')->constrained('mfg_colors');
            $table->foreignId('sizeId')->constrained('mfg_sizes');
            $table->integer('quantity')->default(0);
            $table->timestamp('createdAt')->nullable();
            $table->unique(['stageId', 'colorId', 'sizeId'], 'mfg_psc_stage_color_size_unique');
        });

        Schema::table('mfg_production_order_stages', function (Blueprint $table) {
            $table->string('assignee')->nullable()->after('workshopId');       // encargado
            $table->string('startedByName')->nullable()->after('startedAt');
            $table->string('finishedByName')->nullable()->after('finishedAt');
        });

        Schema::create('mfg_lots', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();                                  // L-2026-0001
            $table->foreignId('productionOrderId')->constrained('mfg_production_orders')->cascadeOnDelete();
            $table->foreignId('warehouseId')->nullable()->constrained('mfg_warehouses')->nullOnDelete();
            $table->string('status')->default('AVAILABLE');                    // AVAILABLE | DEPLETED
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::create('mfg_lot_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lotId')->constrained('mfg_lots')->cascadeOnDelete();
            $table->foreignId('colorId')->constrained('mfg_colors');
            $table->foreignId('sizeId')->constrained('mfg_sizes');
            $table->integer('quantityProduced')->default(0);
            $table->integer('quantityAvailable')->default(0);
            $table->timestamp('createdAt')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mfg_lot_items');
        Schema::dropIfExists('mfg_lots');
        Schema::table('mfg_production_order_stages', function (Blueprint $table) {
            $table->dropColumn(['assignee', 'startedByName', 'finishedByName']);
        });
        Schema::dropIfExists('mfg_production_stage_cells');
    }
};
