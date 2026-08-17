<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ventana de entrega del pedido (como `fecha_inicio_despacho` /
     * `fecha_fin_despacho` de project-fabrica-ropa). `deliveryDate` existente se
     * usa como la fecha "hasta"; se agrega la fecha "desde".
     */
    public function up(): void
    {
        Schema::table('mfg_purchase_orders', function (Blueprint $table) {
            $table->date('dispatchStartDate')->nullable()->after('semester');
        });
    }

    public function down(): void
    {
        Schema::table('mfg_purchase_orders', function (Blueprint $table) {
            $table->dropColumn('dispatchStartDate');
        });
    }
};
