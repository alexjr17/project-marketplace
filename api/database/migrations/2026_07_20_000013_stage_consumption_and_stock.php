<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * - mfg_stage_consumptions : consumo de insumos por etapa (esperado vs real),
     *   calculado desde el BOM de la referencia y la config de consumo del proceso.
     * - mfg_warehouse_stock : stock de producto terminado por bodega (se llena al
     *   crear el lote al finalizar la producción).
     */
    public function up(): void
    {
        Schema::create('mfg_stage_consumptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stageId')->constrained('mfg_production_order_stages')->cascadeOnDelete();
            $table->foreignId('inputId')->constrained('mfg_inputs');
            $table->foreignId('colorId')->nullable()->constrained('mfg_colors')->nullOnDelete();
            $table->decimal('expectedQty', 14, 4)->default(0);
            $table->decimal('realQty', 14, 4)->default(0);
            $table->decimal('unitValue', 14, 4)->default(0);   // snapshot del valor del insumo
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::create('mfg_warehouse_stock', function (Blueprint $table) {
            $table->id();
            $table->foreignId('warehouseId')->constrained('mfg_warehouses')->cascadeOnDelete();
            $table->foreignId('referenceId')->constrained('mfg_references')->cascadeOnDelete();
            $table->foreignId('colorId')->constrained('mfg_colors');
            $table->foreignId('sizeId')->constrained('mfg_sizes');
            $table->integer('quantity')->default(0);
            $table->timestamp('updatedAt')->nullable();
            $table->unique(['warehouseId', 'referenceId', 'colorId', 'sizeId'], 'mfg_ws_wh_ref_color_size_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mfg_warehouse_stock');
        Schema::dropIfExists('mfg_stage_consumptions');
    }
};
