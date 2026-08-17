<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Campos esenciales del cliente (paridad con `Cliente` de project-fabrica-ropa,
     * sin el peso fiscal legacy): tipo de identificación, email, direcciones de
     * facturación y despacho, y plazo de crédito en días.
     */
    public function up(): void
    {
        Schema::table('mfg_clients', function (Blueprint $table) {
            $table->string('documentType')->nullable()->after('documentId'); // C.C | NIT | Otro
            $table->string('email')->nullable()->after('businessName');
            $table->string('invoiceAddress')->nullable()->after('city');
            $table->string('dispatchAddress')->nullable()->after('invoiceAddress');
            $table->integer('creditDays')->nullable()->after('dispatchAddress');
        });
    }

    public function down(): void
    {
        Schema::table('mfg_clients', function (Blueprint $table) {
            $table->dropColumn(['documentType', 'email', 'invoiceAddress', 'dispatchAddress', 'creditDays']);
        });
    }
};
