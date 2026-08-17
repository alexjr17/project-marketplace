<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Lotes / compras de insumo con su precio (como `LoteInsumo` de
     * project-fabrica-ropa). Al agregar un insumo a la ficha técnica se traen sus
     * lotes para decidir el precio (o el promedio).
     */
    public function up(): void
    {
        Schema::create('mfg_input_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inputId')->constrained('mfg_inputs')->cascadeOnDelete();
            $table->foreignId('colorId')->nullable()->constrained('mfg_colors')->nullOnDelete();
            $table->decimal('unitCost', 12, 2)->default(0);
            $table->decimal('quantity', 12, 4)->nullable();
            $table->date('purchasedAt')->nullable();
            $table->string('reference')->nullable(); // nº factura / remisión de compra
            $table->timestamp('createdAt')->nullable();
            $table->index('inputId', 'mfg_ib_input_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mfg_input_batches');
    }
};
