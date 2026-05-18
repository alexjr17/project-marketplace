<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lotes y movimientos de inventario, proveedores, órdenes de compra,
 * conteos físicos y conversiones de inventario.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('input_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inputId')->constrained('inputs')->cascadeOnDelete();
            $table->string('batchNumber');
            $table->string('supplier')->nullable();
            $table->string('invoiceRef')->nullable();
            $table->decimal('initialQuantity', 10, 2);
            $table->decimal('currentQuantity', 10, 2);
            $table->decimal('reservedQuantity', 10, 2)->default(0);
            $table->decimal('unitCost', 10, 2);
            $table->decimal('totalCost', 10, 2);
            $table->dateTime('purchaseDate')->nullable();
            $table->dateTime('expiryDate')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->unique(['inputId', 'batchNumber']);
            $table->index('inputId');
        });

        Schema::create('input_batch_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inputId')->constrained('inputs')->cascadeOnDelete();
            $table->foreignId('inputBatchId')->constrained('input_batches')->cascadeOnDelete();
            $table->enum('movementType', ['ENTRADA', 'SALIDA', 'AJUSTE', 'RESERVA', 'LIBERACION', 'DEVOLUCION', 'MERMA']);
            $table->decimal('quantity', 10, 2);
            $table->string('referenceType')->nullable();
            $table->unsignedBigInteger('referenceId')->nullable();
            $table->text('reason')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('userId')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->index('inputId');
            $table->index('inputBatchId');
            $table->index('movementType');
            $table->index('createdAt');
        });

        Schema::create('input_variant_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inputVariantId')->constrained('input_variants')->cascadeOnDelete();
            $table->enum('movementType', ['ENTRADA', 'SALIDA', 'AJUSTE', 'RESERVA', 'LIBERACION', 'DEVOLUCION', 'MERMA']);
            $table->decimal('quantity', 10, 2);
            $table->decimal('previousStock', 10, 2);
            $table->decimal('newStock', 10, 2);
            $table->string('referenceType')->nullable();
            $table->unsignedBigInteger('referenceId')->nullable();
            $table->text('reason')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('userId')->nullable();
            $table->decimal('unitCost', 10, 2)->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->index('inputVariantId');
            $table->index('movementType');
            $table->index('createdAt');
        });

        Schema::create('variant_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('variantId')->constrained('product_variants')->cascadeOnDelete();
            $table->enum('movementType', ['PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN', 'DAMAGE', 'INITIAL']);
            $table->integer('quantity');
            $table->integer('previousStock');
            $table->integer('newStock');
            $table->string('referenceType')->nullable();
            $table->unsignedBigInteger('referenceId')->nullable();
            $table->text('reason')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('userId')->nullable();
            $table->decimal('unitCost', 10, 2)->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->index('variantId');
            $table->index('movementType');
            $table->index(['referenceType', 'referenceId']);
            $table->index('createdAt');
        });

        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('taxId')->nullable();
            $table->string('taxIdType')->nullable();
            $table->string('contactName')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('altPhone')->nullable();
            $table->string('website')->nullable();
            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->string('department')->nullable();
            $table->string('postalCode')->nullable();
            $table->string('country')->default('Colombia');
            $table->string('paymentTerms')->nullable();
            $table->string('paymentMethod')->nullable();
            $table->string('bankName')->nullable();
            $table->string('bankAccountType')->nullable();
            $table->string('bankAccount')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('name');
            $table->index('taxId');
        });

        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->string('orderNumber')->unique();
            $table->foreignId('supplierId')->constrained('suppliers');
            $table->enum('status', ['DRAFT', 'SENT', 'CONFIRMED', 'PARTIAL', 'RECEIVED', 'CANCELLED'])->default('DRAFT');
            $table->decimal('subtotal', 10, 2);
            $table->decimal('tax', 10, 2)->default(0);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('total', 10, 2);
            $table->dateTime('orderDate')->useCurrent();
            $table->dateTime('expectedDate')->nullable();
            $table->dateTime('receivedDate')->nullable();
            $table->string('supplierInvoice')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('createdById')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('supplierId');
            $table->index('status');
            $table->index('orderDate');
        });

        Schema::create('purchase_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchaseOrderId')->constrained('purchase_orders')->cascadeOnDelete();
            $table->foreignId('variantId')->nullable()->constrained('product_variants');
            $table->foreignId('inputId')->nullable()->constrained('inputs');
            $table->foreignId('inputVariantId')->nullable()->constrained('input_variants');
            $table->string('description')->nullable();
            $table->decimal('quantity', 10, 2);
            $table->decimal('quantityReceived', 10, 2)->default(0);
            $table->decimal('unitCost', 10, 2);
            $table->decimal('subtotal', 10, 2);
            $table->text('notes')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('purchaseOrderId');
            $table->index('variantId');
            $table->index('inputId');
            $table->index('inputVariantId');
        });

        Schema::create('inventory_counts', function (Blueprint $table) {
            $table->id();
            $table->string('countNumber')->unique();
            $table->enum('countType', ['FULL', 'PARTIAL'])->default('FULL');
            $table->enum('status', ['DRAFT', 'IN_PROGRESS', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED'])->default('DRAFT');
            $table->dateTime('countDate')->useCurrent();
            $table->unsignedBigInteger('countedById')->nullable();
            $table->string('countedByName')->nullable();
            $table->unsignedBigInteger('approvedById')->nullable();
            $table->string('approvedByName')->nullable();
            $table->dateTime('approvedAt')->nullable();
            $table->text('notes')->nullable();
            $table->integer('totalItems')->default(0);
            $table->integer('itemsWithDiff')->default(0);
            $table->decimal('totalDiffValue', 10, 2)->default(0);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('status');
            $table->index('countDate');
        });

        Schema::create('inventory_count_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventoryCountId')->constrained('inventory_counts')->cascadeOnDelete();
            $table->unsignedBigInteger('inputId');
            $table->string('inputCode');
            $table->string('inputName');
            $table->string('unitOfMeasure');
            $table->decimal('unitCost', 10, 2);
            $table->decimal('systemQuantity', 10, 2);
            $table->decimal('countedQuantity', 10, 2)->nullable();
            $table->decimal('difference', 10, 2)->nullable();
            $table->decimal('differenceValue', 10, 2)->nullable();
            $table->boolean('isCounted')->default(false);
            $table->text('notes')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->unique(['inventoryCountId', 'inputId']);
            $table->index('inventoryCountId');
            $table->index('inputId');
        });

        Schema::create('inventory_conversions', function (Blueprint $table) {
            $table->id();
            $table->string('conversionNumber')->unique();
            $table->enum('conversionType', ['MANUAL', 'TEMPLATE'])->default('MANUAL');
            $table->unsignedBigInteger('templateId')->nullable();
            $table->unsignedBigInteger('templateVariantId')->nullable();
            $table->enum('status', ['DRAFT', 'PENDING', 'APPROVED', 'CANCELLED'])->default('DRAFT');
            $table->dateTime('conversionDate')->useCurrent();
            $table->unsignedBigInteger('createdById')->nullable();
            $table->string('createdByName')->nullable();
            $table->unsignedBigInteger('approvedById')->nullable();
            $table->string('approvedByName')->nullable();
            $table->dateTime('approvedAt')->nullable();
            $table->text('description')->nullable();
            $table->text('notes')->nullable();
            $table->decimal('totalInputCost', 10, 2)->default(0);
            $table->decimal('totalOutputCost', 10, 2)->default(0);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('status');
            $table->index('conversionDate');
            $table->index('createdById');
            $table->index('conversionType');
            $table->index('templateId');
        });

        Schema::create('conversion_input_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversionId')->constrained('inventory_conversions')->cascadeOnDelete();
            $table->unsignedBigInteger('inputVariantId');
            $table->string('inputCode');
            $table->string('inputName');
            $table->string('variantSku');
            $table->string('colorName')->nullable();
            $table->string('sizeName')->nullable();
            $table->string('unitOfMeasure');
            $table->decimal('unitCost', 10, 2);
            $table->decimal('quantity', 10, 2);
            $table->decimal('totalCost', 10, 2);
            $table->text('notes')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->index('conversionId');
            $table->index('inputVariantId');
        });

        Schema::create('conversion_output_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversionId')->constrained('inventory_conversions')->cascadeOnDelete();
            $table->unsignedBigInteger('variantId');
            $table->string('productName');
            $table->string('variantSku');
            $table->string('colorName')->nullable();
            $table->string('sizeName')->nullable();
            $table->decimal('unitPrice', 10, 2);
            $table->integer('quantity');
            $table->decimal('totalValue', 10, 2);
            $table->text('notes')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->index('conversionId');
            $table->index('variantId');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversion_output_items');
        Schema::dropIfExists('conversion_input_items');
        Schema::dropIfExists('inventory_conversions');
        Schema::dropIfExists('inventory_count_items');
        Schema::dropIfExists('inventory_counts');
        Schema::dropIfExists('purchase_order_items');
        Schema::dropIfExists('purchase_orders');
        Schema::dropIfExists('suppliers');
        Schema::dropIfExists('variant_movements');
        Schema::dropIfExists('input_variant_movements');
        Schema::dropIfExists('input_batch_movements');
        Schema::dropIfExists('input_batches');
    }
};
