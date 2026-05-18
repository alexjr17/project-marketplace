<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Productos, sus relaciones con colores/tallas y las variantes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('sku')->unique();
            $table->string('slug')->unique();
            $table->string('name');
            $table->text('description');
            $table->string('barcode')->nullable()->unique();
            $table->foreignId('categoryId')->nullable()->constrained('categories')->nullOnDelete();
            $table->foreignId('typeId')->nullable()->constrained('product_types')->nullOnDelete();
            $table->decimal('basePrice', 10, 2);
            $table->integer('stock')->default(0);
            $table->boolean('featured')->default(false);
            $table->boolean('isActive')->default(true);
            $table->boolean('isTemplate')->default(false);
            $table->json('images');
            $table->json('tags');
            $table->json('zoneTypeImages')->nullable();
            $table->json('designZones')->nullable();
            $table->json('exclusionZones')->nullable();
            $table->decimal('rating', 2, 1)->nullable();
            $table->integer('reviewsCount')->nullable()->default(0);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::create('product_colors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('productId')->constrained('products')->cascadeOnDelete();
            $table->foreignId('colorId')->constrained('colors')->cascadeOnDelete();
            $table->timestamp('createdAt')->nullable();
            $table->unique(['productId', 'colorId']);
        });

        Schema::create('product_sizes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('productId')->constrained('products')->cascadeOnDelete();
            $table->foreignId('sizeId')->constrained('sizes')->cascadeOnDelete();
            $table->timestamp('createdAt')->nullable();
            $table->unique(['productId', 'sizeId']);
        });

        Schema::create('product_type_sizes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('productTypeId')->constrained('product_types')->cascadeOnDelete();
            $table->foreignId('sizeId')->constrained('sizes')->cascadeOnDelete();
            $table->timestamp('createdAt')->nullable();
            $table->unique(['productTypeId', 'sizeId']);
        });

        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('productId')->constrained('products')->cascadeOnDelete();
            $table->foreignId('colorId')->nullable()->constrained('colors');
            $table->foreignId('sizeId')->nullable()->constrained('sizes');
            $table->string('sku')->unique();
            $table->string('barcode')->nullable()->unique();
            $table->integer('stock')->default(0);
            $table->integer('minStock')->default(0);
            $table->decimal('priceAdjustment', 10, 2)->nullable();
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('productId');
            $table->index('barcode');
            $table->index('sku');
            $table->index(['productId', 'colorId', 'sizeId']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_variants');
        Schema::dropIfExists('product_type_sizes');
        Schema::dropIfExists('product_sizes');
        Schema::dropIfExists('product_colors');
        Schema::dropIfExists('products');
    }
};
