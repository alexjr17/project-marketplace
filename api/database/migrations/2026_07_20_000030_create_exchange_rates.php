<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tasa de cambio (COP → USD) de la app Fábrica, como el módulo `exchange-rate`
     * de project-fabrica-ropa. La activa se usa para convertir los precios de los
     * grupos de exportación a dólares.
     */
    public function up(): void
    {
        Schema::create('mfg_exchange_rates', function (Blueprint $table) {
            $table->id();
            $table->decimal('rate', 12, 4);        // COP por 1 USD
            $table->string('currency')->default('USD');
            $table->boolean('isActive')->default(true);
            $table->date('effectiveDate')->nullable();
            $table->timestamp('createdAt')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mfg_exchange_rates');
    }
};
