<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Consecutivos de los documentos (ORD-, POS-, OC-, DEV-, INV-, CONV-, PED-, OP-, L-, DES-,
     * códigos de referencia…). Una fila por serie: `key` = tipo + prefijo con su periodo
     * (p. ej. "pos_sale:POS-261102-") y `lastValue` = último número entregado.
     * La usa App\Services\NumberSequenceService con bloqueo de fila. Idempotente.
     */
    public function up(): void
    {
        if (Schema::hasTable('number_sequences')) {
            return;
        }

        Schema::create('number_sequences', function (Blueprint $table) {
            $table->id();
            $table->string('key', 191)->unique();
            $table->unsignedBigInteger('lastValue')->default(0);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('number_sequences');
    }
};
