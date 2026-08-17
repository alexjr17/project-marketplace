<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fechas de entrega parciales del pedido (como `fecha_parcial_1..4` de
     * project-fabrica-ropa). Se guardan como lista JSON (hasta 4) para no crear
     * columnas fijas.
     */
    public function up(): void
    {
        Schema::table('mfg_purchase_orders', function (Blueprint $table) {
            $table->json('partialDates')->nullable()->after('deliveryDate');
        });
    }

    public function down(): void
    {
        Schema::table('mfg_purchase_orders', function (Blueprint $table) {
            $table->dropColumn('partialDates');
        });
    }
};
