<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Configuración, zonas y recetas de plantillas, imágenes de diseño,
 * plantillas de etiquetas, reseñas y notificaciones.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->json('value');
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::create('zone_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->integer('sortOrder')->default(0);
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::create('template_zones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('templateId')->constrained('products')->cascadeOnDelete();
            $table->foreignId('zoneTypeId')->constrained('zone_types');
            $table->string('zoneId');
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('shape')->default('rect');
            $table->integer('maxWidth');
            $table->integer('maxHeight');
            $table->integer('positionX');
            $table->integer('positionY');
            $table->integer('radius')->nullable();
            $table->json('points')->nullable();
            $table->boolean('isEditable')->default(true);
            $table->boolean('isRequired')->default(false);
            $table->boolean('isBlocked')->default(false);
            $table->decimal('price', 10, 2)->default(0);
            $table->integer('sortOrder')->default(0);
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('templateId');
            $table->index('zoneTypeId');
        });

        Schema::create('zone_inputs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('templateZoneId')->unique()->constrained('template_zones')->cascadeOnDelete();
            $table->foreignId('inputId')->nullable()->constrained('inputs')->nullOnDelete();
            $table->string('imageUrl');
            $table->longText('imageData')->nullable();
            $table->longText('originalImageData')->nullable();
            $table->string('fileName')->nullable();
            $table->integer('fileSize')->nullable();
            $table->integer('positionX')->default(0);
            $table->integer('positionY')->default(0);
            $table->integer('width')->default(100);
            $table->integer('height')->default(100);
            $table->double('rotation')->default(0);
            $table->double('opacity')->default(1);
            $table->boolean('isLocked')->default(false);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('inputId');
        });

        Schema::create('template_recipes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('variantId')->constrained('product_variants')->cascadeOnDelete();
            $table->foreignId('inputVariantId')->constrained('input_variants');
            $table->decimal('quantity', 10, 2)->default(1);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->unique(['variantId', 'inputVariantId']);
            $table->index('variantId');
            $table->index('inputVariantId');
        });

        Schema::create('design_images', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->longText('thumbnailUrl');
            $table->string('fullUrl', 500);
            $table->string('category')->nullable();
            $table->json('tags')->nullable();
            $table->integer('sortOrder')->default(0);
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('category');
            $table->index('isActive');
        });

        Schema::create('label_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->longText('backgroundImage')->nullable();
            $table->double('width')->default(170.08);
            $table->double('height')->default(255.12);
            $table->string('pageType')->default('A4');
            $table->double('pageMargin')->default(30);
            $table->double('labelSpacing')->default(10);
            $table->boolean('isDefault')->default(false);
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('isDefault');
        });

        Schema::create('label_template_product_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('labelTemplateId')->constrained('label_templates')->cascadeOnDelete();
            $table->foreignId('productTypeId')->constrained('product_types')->cascadeOnDelete();
            $table->timestamp('createdAt')->nullable();
            $table->unique(['labelTemplateId', 'productTypeId'], 'label_tpt_unique');
            $table->index('labelTemplateId');
            $table->index('productTypeId');
        });

        Schema::create('label_zones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('labelTemplateId')->constrained('label_templates')->cascadeOnDelete();
            $table->enum('zoneType', ['PRODUCT_NAME', 'SIZE', 'COLOR', 'BARCODE', 'BARCODE_TEXT', 'SKU', 'PRICE', 'CUSTOM_TEXT']);
            $table->double('x');
            $table->double('y');
            $table->double('width');
            $table->double('height');
            $table->integer('fontSize')->default(10);
            $table->string('fontWeight')->default('normal');
            $table->string('textAlign')->default('center');
            $table->string('fontColor')->default('#000000');
            $table->boolean('showLabel')->default(true);
            $table->integer('rotation')->default(0);
            $table->integer('zIndex')->default(0);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('labelTemplateId');
            $table->index('zoneType');
        });

        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('userId')->constrained('users')->cascadeOnDelete();
            $table->foreignId('productId')->constrained('products')->cascadeOnDelete();
            $table->integer('rating');
            $table->string('title', 200)->nullable();
            $table->text('comment');
            $table->boolean('verifiedPurchase')->default(true);
            $table->integer('helpfulCount')->default(0);
            $table->enum('status', ['PENDING', 'APPROVED', 'REJECTED'])->default('APPROVED');
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->unique(['userId', 'productId']);
            $table->index('productId');
            $table->index('userId');
            $table->index('status');
        });

        Schema::create('review_helpful_votes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reviewId')->constrained('reviews')->cascadeOnDelete();
            $table->foreignId('userId')->constrained('users')->cascadeOnDelete();
            $table->boolean('isHelpful');
            $table->timestamp('createdAt')->nullable();
            $table->unique(['reviewId', 'userId']);
            $table->index('reviewId');
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('userId')->constrained('users')->cascadeOnDelete();
            $table->enum('type', ['REVIEW_AVAILABLE', 'ORDER_STATUS', 'PROMO', 'SYSTEM']);
            $table->string('title');
            $table->text('message');
            $table->string('referenceType')->nullable();
            $table->unsignedBigInteger('referenceId')->nullable();
            $table->boolean('isRead')->default(false);
            $table->timestamp('createdAt')->nullable();
            $table->index('userId');
            $table->index(['userId', 'isRead']);
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('review_helpful_votes');
        Schema::dropIfExists('reviews');
        Schema::dropIfExists('label_zones');
        Schema::dropIfExists('label_template_product_types');
        Schema::dropIfExists('label_templates');
        Schema::dropIfExists('design_images');
        Schema::dropIfExists('template_recipes');
        Schema::dropIfExists('zone_inputs');
        Schema::dropIfExists('template_zones');
        Schema::dropIfExists('zone_types');
        Schema::dropIfExists('settings');
    }
};
