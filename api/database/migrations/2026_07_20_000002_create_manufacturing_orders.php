<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * App "Fábrica" — Fase 2: órdenes de producción manuales.
     *
     *   - mfg_production_orders       : cabecera (OP-2026-0001), referencia y estado.
     *   - mfg_production_order_items  : matriz talla×color con cantidad y avance.
     *   - mfg_production_order_stages : etapas de la orden (copiadas del catálogo de
     *                                   procesos), con estado, taller y avance.
     */
    public function up(): void
    {
        Schema::create('mfg_production_orders', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();                 // OP-2026-0001
            $table->foreignId('referenceId')->constrained('mfg_references');
            $table->foreignId('warehouseId')->nullable()->constrained('mfg_warehouses')->nullOnDelete();
            $table->string('status')->default('PROGRAMMED');  // DRAFT|PROGRAMMED|IN_PROCESS|COMPLETED|CANCELLED
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('createdBy')->nullable();
            $table->timestamp('startedAt')->nullable();
            $table->timestamp('finishedAt')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::create('mfg_production_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('productionOrderId')->constrained('mfg_production_orders')->cascadeOnDelete();
            $table->foreignId('colorId')->constrained('mfg_colors');
            $table->foreignId('sizeId')->constrained('mfg_sizes');
            $table->integer('quantity')->default(0);
            $table->integer('quantityDone')->default(0);
            $table->timestamp('createdAt')->nullable();
            $table->unique(['productionOrderId', 'colorId', 'sizeId'], 'mfg_poi_order_color_size_unique');
        });

        Schema::create('mfg_production_order_stages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('productionOrderId')->constrained('mfg_production_orders')->cascadeOnDelete();
            $table->foreignId('processId')->constrained('mfg_processes');
            $table->foreignId('workshopId')->nullable()->constrained('mfg_workshops')->nullOnDelete();
            $table->integer('sequence')->default(0);
            $table->string('status')->default('PENDING');     // PENDING|IN_PROCESS|COMPLETED|SKIPPED
            $table->integer('quantityDone')->default(0);
            $table->text('notes')->nullable();
            $table->timestamp('startedAt')->nullable();
            $table->timestamp('finishedAt')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mfg_production_order_stages');
        Schema::dropIfExists('mfg_production_order_items');
        Schema::dropIfExists('mfg_production_orders');
    }
};
