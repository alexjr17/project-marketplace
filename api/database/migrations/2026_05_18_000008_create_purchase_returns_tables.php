<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Devoluciones de compra: módulo aparte para devolver al proveedor stock
 * que entró por una orden de compra (total o parcial). Cada devolución
 * nace obligatoriamente de una orden de compra y revierte el stock de una
 * (procesamiento directo).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_returns', function (Blueprint $table) {
            $table->id();
            $table->string('returnNumber')->unique();
            $table->foreignId('purchaseOrderId')->constrained('purchase_orders');
            $table->foreignId('supplierId')->constrained('suppliers');
            $table->text('reason');
            $table->text('notes')->nullable();
            $table->decimal('total', 12, 2)->default(0);
            $table->unsignedBigInteger('createdById')->nullable();
            $table->string('createdByName')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('purchaseOrderId');
            $table->index('supplierId');
        });

        Schema::create('purchase_return_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchaseReturnId')->constrained('purchase_returns')->cascadeOnDelete();
            $table->unsignedBigInteger('purchaseOrderItemId')->nullable();
            $table->unsignedBigInteger('variantId')->nullable();
            $table->unsignedBigInteger('inputId')->nullable();
            $table->unsignedBigInteger('inputVariantId')->nullable();
            $table->string('description')->nullable();
            $table->decimal('quantity', 10, 2);
            $table->decimal('unitCost', 10, 2);
            $table->decimal('subtotal', 12, 2);
            $table->timestamp('createdAt')->nullable();
            $table->index('purchaseReturnId');
            $table->index('purchaseOrderItemId');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_return_items');
        Schema::dropIfExists('purchase_returns');
    }
};
