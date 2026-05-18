<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Carrito, clientes POS, cajas, sesiones de caja, pedidos y pagos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('carts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('userId')->unique()->constrained('users')->cascadeOnDelete();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::create('cart_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cartId')->constrained('carts')->cascadeOnDelete();
            // productId / variantId sin FK: pueden referenciar productos normales o nada (personalizados).
            $table->unsignedBigInteger('productId')->nullable();
            $table->unsignedBigInteger('variantId')->nullable();
            $table->boolean('isCustomized')->default(false);
            $table->json('customization')->nullable();
            $table->integer('quantity');
            $table->decimal('unitPrice', 10, 2);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('cartId');
        });

        Schema::create('pos_customers', function (Blueprint $table) {
            $table->id();
            $table->string('cedula')->unique();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->integer('totalPurchases')->default(0);
            $table->decimal('totalSpent', 10, 2)->default(0);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('cedula');
            $table->index('name');
        });

        Schema::create('cash_registers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('location');
            $table->string('code')->unique();
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::create('cash_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cashRegisterId')->constrained('cash_registers');
            $table->foreignId('sellerId')->constrained('users');
            $table->dateTime('openedAt')->useCurrent();
            $table->dateTime('closedAt')->nullable();
            $table->decimal('initialCash', 10, 2);
            $table->decimal('finalCash', 10, 2)->nullable();
            $table->decimal('expectedCash', 10, 2)->nullable();
            $table->decimal('difference', 10, 2)->nullable();
            $table->integer('salesCount')->default(0);
            $table->decimal('totalSales', 10, 2)->default(0);
            $table->text('notes')->nullable();
            $table->enum('status', ['OPEN', 'CLOSED'])->default('OPEN');
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('cashRegisterId');
            $table->index('sellerId');
            $table->index('status');
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('orderNumber')->unique();
            $table->foreignId('userId')->nullable()->constrained('users');
            $table->foreignId('posCustomerId')->nullable()->constrained('pos_customers');
            $table->string('customerName')->nullable();
            $table->string('customerEmail')->nullable();
            $table->string('customerPhone')->nullable();
            $table->decimal('subtotal', 10, 2);
            $table->decimal('shippingCost', 10, 2)->default(0);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('tax', 10, 2)->default(0);
            $table->decimal('total', 10, 2);
            $table->enum('status', ['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'])->default('PENDING');
            $table->string('paymentMethod');
            $table->string('paymentRef')->nullable();
            $table->decimal('cashAmount', 10, 2)->nullable();
            $table->decimal('cardAmount', 10, 2)->nullable();
            $table->string('cardReference')->nullable();
            $table->string('cardType')->nullable();
            $table->string('cardLastFour')->nullable();
            $table->longText('paymentEvidence')->nullable();
            $table->enum('saleChannel', ['ONLINE', 'POS'])->default('ONLINE');
            $table->foreignId('sellerId')->nullable()->constrained('users');
            $table->foreignId('cashRegisterId')->nullable()->constrained('cash_registers');
            $table->json('shipping')->nullable();
            $table->string('trackingNumber')->nullable();
            $table->string('trackingUrl')->nullable();
            $table->text('notes')->nullable();
            $table->json('statusHistory');
            $table->dateTime('paidAt')->nullable();
            $table->dateTime('shippedAt')->nullable();
            $table->dateTime('deliveredAt')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('orderId')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('productId')->constrained('products');
            $table->string('productName');
            $table->longText('productImage');
            $table->foreignId('variantId')->nullable()->constrained('product_variants');
            $table->string('size');
            $table->string('color');
            $table->integer('quantity');
            $table->decimal('unitPrice', 10, 2);
            $table->json('customization')->nullable();
            $table->timestamp('createdAt')->nullable();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('orderId')->constrained('orders')->cascadeOnDelete();
            $table->string('transactionId')->nullable()->unique();
            $table->string('paymentMethod');
            $table->decimal('amount', 10, 2);
            $table->string('currency')->default('COP');
            $table->enum('status', ['PENDING', 'PROCESSING', 'APPROVED', 'DECLINED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'PARTIAL_REFUND'])->default('PENDING');
            $table->string('receiptUrl', 500)->nullable();
            $table->longText('receiptData')->nullable();
            $table->string('payerName')->nullable();
            $table->string('payerEmail')->nullable();
            $table->string('payerPhone')->nullable();
            $table->string('payerDocument')->nullable();
            $table->text('failureReason')->nullable();
            $table->string('failureCode')->nullable();
            $table->unsignedBigInteger('verifiedBy')->nullable();
            $table->dateTime('verifiedAt')->nullable();
            $table->text('notes')->nullable();
            $table->decimal('refundedAmount', 10, 2)->default(0);
            $table->dateTime('refundedAt')->nullable();
            $table->text('refundReason')->nullable();
            $table->dateTime('initiatedAt')->useCurrent();
            $table->dateTime('paidAt')->nullable();
            $table->dateTime('failedAt')->nullable();
            $table->dateTime('cancelledAt')->nullable();
            $table->dateTime('expiredAt')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('orderId');
            $table->index('transactionId');
            $table->index('status');
            $table->index('paymentMethod');
            $table->index('initiatedAt');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('cash_sessions');
        Schema::dropIfExists('cash_registers');
        Schema::dropIfExists('pos_customers');
        Schema::dropIfExists('cart_items');
        Schema::dropIfExists('carts');
    }
};
