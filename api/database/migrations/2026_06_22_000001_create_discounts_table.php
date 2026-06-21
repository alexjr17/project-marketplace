<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cupones / descuentos. Un cupón tiene un código, un tipo (porcentaje o
     * monto fijo) y un valor. Puede segmentarse por producto, categoría o
     * usuario, y aplicar a la tienda, al POS o a ambos. Soporta mínimo de
     * compra, límite de usos (total y por usuario) y vigencia por fechas.
     */
    public function up(): void
    {
        Schema::create('discounts', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();              // BIENVENIDA10 (se guarda en mayúsculas)
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
