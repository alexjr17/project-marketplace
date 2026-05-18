<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Inventario de insumos: tipos, insumos, sus relaciones y variantes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('input_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->integer('sortOrder')->default(0);
            $table->boolean('isActive')->default(true);
            $table->boolean('hasVariants')->default(false);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::create('inputs', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->foreignId('inputTypeId')->constrained('input_types');
            $table->string('unitOfMeasure');
            $table->decimal('unitCost', 10, 2);
            $table->decimal('currentStock', 10, 2)->default(0);
            $table->decimal('minStock', 10, 2)->default(0);
            $table->decimal('maxStock', 10, 2)->default(0);
            $table->string('supplier')->nullable();
            $table->string('supplierCode')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('inputTypeId');
        });

        Schema::create('input_type_sizes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inputTypeId')->constrained('input_types')->cascadeOnDelete();
            $table->foreignId('sizeId')->constrained('sizes')->cascadeOnDelete();
            $table->timestamp('createdAt')->nullable();
            $table->unique(['inputTypeId', 'sizeId']);
        });

        Schema::create('input_colors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inputId')->constrained('inputs')->cascadeOnDelete();
            $table->foreignId('colorId')->constrained('colors')->cascadeOnDelete();
            $table->timestamp('createdAt')->nullable();
            $table->unique(['inputId', 'colorId']);
        });

        Schema::create('input_sizes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inputId')->constrained('inputs')->cascadeOnDelete();
            $table->foreignId('sizeId')->constrained('sizes')->cascadeOnDelete();
            $table->timestamp('createdAt')->nullable();
            $table->unique(['inputId', 'sizeId']);
        });

        Schema::create('input_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inputId')->constrained('inputs')->cascadeOnDelete();
            $table->foreignId('colorId')->nullable()->constrained('colors')->nullOnDelete();
            $table->foreignId('sizeId')->nullable()->constrained('sizes')->nullOnDelete();
            $table->string('sku')->unique();
            $table->decimal('unitCost', 10, 2);
            $table->decimal('currentStock', 10, 2)->default(0);
            $table->decimal('minStock', 10, 2)->default(0);
            $table->decimal('maxStock', 10, 2)->default(0);
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->unique(['inputId', 'colorId', 'sizeId']);
            $table->index('inputId');
            $table->index('colorId');
            $table->index('sizeId');
        });

        Schema::create('product_inputs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('productId')->constrained('products')->cascadeOnDelete();
            $table->foreignId('inputId')->constrained('inputs')->cascadeOnDelete();
            $table->timestamp('createdAt')->nullable();
            $table->unique(['productId', 'inputId']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_inputs');
        Schema::dropIfExists('input_variants');
        Schema::dropIfExists('input_sizes');
        Schema::dropIfExists('input_colors');
        Schema::dropIfExists('input_type_sizes');
        Schema::dropIfExists('inputs');
        Schema::dropIfExists('input_types');
    }
};
