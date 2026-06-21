<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Historial de cambios de la venta (creación y cada edición): registra
     * qué campos cambiaron (montos, descuento, método de pago, etc.), quién y
     * cuándo. Para auditar ajustes de dinero/cobros sobre una venta POS.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->json('editHistory')->nullable()->after('statusHistory');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('editHistory');
        });
    }
};
