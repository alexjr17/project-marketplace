<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Datos de remisión / facturación del despacho (como `numero_remision`,
     * `numero_factura`, `fecha_facturacion` de project-fabrica-ropa).
     */
    public function up(): void
    {
        Schema::table('mfg_dispatches', function (Blueprint $table) {
            $table->string('shipmentNumber')->nullable()->after('type'); // N° remisión
            $table->string('invoiceNumber')->nullable()->after('shipmentNumber');
            $table->date('invoicedAt')->nullable()->after('invoiceNumber');
        });
    }

    public function down(): void
    {
        Schema::table('mfg_dispatches', function (Blueprint $table) {
            $table->dropColumn(['shipmentNumber', 'invoiceNumber', 'invoicedAt']);
        });
    }
};
