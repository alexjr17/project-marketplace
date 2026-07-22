<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Órdenes de pedido de la app Fábrica (como `OrdenPedido` de project-fabrica-ropa):
     * un cliente pide varias referencias (matriz talla×color). Desde un pedido se
     * generan las órdenes de producción (una por referencia). Clientes propios de
     * Fábrica (catálogo independiente).
     */
    public function up(): void
    {
        // Clientes (catálogo propio de Fábrica).
        Schema::create('mfg_clients', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('documentId')->nullable();     // NIT / cédula
            $table->string('businessName')->nullable();    // nombre del negocio
            $table->string('phone')->nullable();
            $table->string('city')->nullable();
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        // Cabecera del pedido.
        Schema::create('mfg_purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();              // PED-2026-0001
            $table->foreignId('clientId')->constrained('mfg_clients');
            $table->foreignId('collectionId')->nullable()->constrained('mfg_collections')->nullOnDelete();
            $table->string('semester')->nullable();        // I | II
            $table->string('status')->default('DRAFT');    // DRAFT|APPROVED|IN_PRODUCTION|DELIVERED|CANCELLED
            $table->date('deliveryDate')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('createdBy')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        // Detalle (una fila por celda referencia×talla×color con cantidad).
        Schema::create('mfg_purchase_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchaseOrderId')->constrained('mfg_purchase_orders')->cascadeOnDelete();
            $table->foreignId('referenceId')->constrained('mfg_references');
            $table->foreignId('colorId')->constrained('mfg_colors');
            $table->foreignId('sizeId')->constrained('mfg_sizes');
            $table->integer('quantity')->default(0);
            // Marca que esta celda ya fue mandada a producción (no duplicar).
            $table->foreignId('productionOrderId')->nullable()->constrained('mfg_production_orders')->nullOnDelete();
            $table->timestamp('createdAt')->nullable();
            $table->unique(['purchaseOrderId', 'referenceId', 'colorId', 'sizeId'], 'mfg_poitm_unique');
        });

        // Vínculo de la orden de producción de vuelta al pedido que la originó.
        Schema::table('mfg_production_orders', function (Blueprint $table) {
            $table->foreignId('purchaseOrderId')->nullable()->after('referenceId')
                ->constrained('mfg_purchase_orders')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('mfg_production_orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('purchaseOrderId');
        });
        Schema::dropIfExists('mfg_purchase_order_items');
        Schema::dropIfExists('mfg_purchase_orders');
        Schema::dropIfExists('mfg_clients');
    }
};
