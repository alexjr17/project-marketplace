<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Despachos / entregas de producto terminado (como `Despacho` de
     * project-fabrica-ropa). Cierra el ciclo: descuenta los lotes (FIFO) y el
     * stock de bodega, registra el kardex de producto y avanza el estado del
     * pedido según lo entregado.
     */
    public function up(): void
    {
        // Kardex único de producto terminado (entradas de lote, salidas de despacho, ajustes).
        Schema::create('mfg_product_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('referenceId')->constrained('mfg_references');
            $table->foreignId('colorId')->constrained('mfg_colors');
            $table->foreignId('sizeId')->constrained('mfg_sizes');
            $table->foreignId('warehouseId')->nullable()->constrained('mfg_warehouses')->nullOnDelete();
            $table->foreignId('lotId')->nullable()->constrained('mfg_lots')->nullOnDelete();
            $table->string('type');                 // ENTRADA | SALIDA | ADJUST
            $table->integer('quantity');            // positivo; el signo lo da el type
            $table->string('sourceType')->nullable(); // LOT | DISPATCH | ADJUST
            $table->unsignedBigInteger('sourceId')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('createdBy')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->index(['referenceId', 'colorId', 'sizeId'], 'mfg_pm_ref_color_size_idx');
        });

        // Cabecera del despacho.
        Schema::create('mfg_dispatches', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();       // DES-2026-0001
            $table->foreignId('clientId')->nullable()->constrained('mfg_clients')->nullOnDelete();
            $table->foreignId('purchaseOrderId')->nullable()->constrained('mfg_purchase_orders')->nullOnDelete();
            $table->foreignId('warehouseId')->nullable()->constrained('mfg_warehouses')->nullOnDelete();
            $table->string('type')->default('VENTA'); // VENTA | CONSIGNACION | TRASLADO | MUESTRA
            $table->string('status')->default('DRAFT'); // DRAFT | CONFIRMED | CANCELLED
            $table->text('notes')->nullable();
            $table->timestamp('dispatchedAt')->nullable();
            $table->unsignedBigInteger('createdBy')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        // Detalle (una fila por celda referencia×color×talla).
        Schema::create('mfg_dispatch_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dispatchId')->constrained('mfg_dispatches')->cascadeOnDelete();
            $table->foreignId('referenceId')->constrained('mfg_references');
            $table->foreignId('colorId')->constrained('mfg_colors');
            $table->foreignId('sizeId')->constrained('mfg_sizes');
            $table->integer('quantity')->default(0);
            $table->timestamp('createdAt')->nullable();
            $table->unique(['dispatchId', 'referenceId', 'colorId', 'sizeId'], 'mfg_ditem_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mfg_dispatch_items');
        Schema::dropIfExists('mfg_dispatches');
        Schema::dropIfExists('mfg_product_movements');
    }
};
