<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cupones / descuentos. Hay dos modos:
     *  - Con código (isAuto=false): el cliente lo canjea al pagar.
     *  - Automático (isAuto=true, sin código): se aplica solo a los productos/
     *    categorías objetivo y se refleja en el precio en toda la tienda.
     * Tipo porcentaje o monto fijo. Segmentable por producto, categoría o
     * usuario, y por canal (tienda/POS/ambos). Soporta mínimo de compra,
     * límite de usos (total y por usuario) y vigencia por fechas.
     */
    public function up(): void
    {
        Schema::create('discounts', function (Blueprint $table) {
            $table->id();
            $table->string('code')->nullable()->unique();  // BIENVENIDA10 (null = automático)
            $table->boolean('isAuto')->default(false);     // true = sin código, aplica solo
            $table->string('name')->nullable();            // etiqueta interna
            $table->string('type')->default('percent');    // percent | fixed
            $table->decimal('value', 10, 2)->default(0);   // 10 (=10%) o 5000 (=$5.000)
            $table->string('appliesTo')->default('all');   // all | product | category | user
            $table->json('targetIds')->nullable();         // ids de producto/categoría/usuario según appliesTo
            $table->string('channel')->default('all');     // all | online | pos
            $table->decimal('minSubtotal', 10, 2)->nullable();
            $table->integer('maxUses')->nullable();        // usos totales permitidos
            $table->integer('maxUsesPerUser')->nullable(); // usos por usuario
            $table->integer('usedCount')->default(0);
            $table->boolean('isActive')->default(true);
            $table->dateTime('startsAt')->nullable();
            $table->dateTime('endsAt')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discounts');
    }
};
