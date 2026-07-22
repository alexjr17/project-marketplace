<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Sustitución de insumos por orden (como `OrdenCorteInsumoSustitucion`):
     * permite reemplazar un insumo del BOM (p. ej. una tela) por otro parecido
     * en una orden concreta, sin cambiar la referencia.
     */
    public function up(): void
    {
        Schema::create('mfg_order_input_substitutions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('productionOrderId')->constrained('mfg_production_orders')->cascadeOnDelete();
            $table->foreignId('originalInputId')->constrained('mfg_inputs')->cascadeOnDelete();
            $table->foreignId('substituteInputId')->constrained('mfg_inputs')->cascadeOnDelete();
            $table->foreignId('colorId')->nullable()->constrained('mfg_colors')->nullOnDelete();
            $table->timestamp('createdAt')->nullable();
            $table->unique(['productionOrderId', 'originalInputId', 'colorId'], 'mfg_ois_order_input_color_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mfg_order_input_substitutions');
    }
};
