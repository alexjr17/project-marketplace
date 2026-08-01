<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Campos adicionales de la cabecera de la orden de producción (paridad con
     * project-fabrica-ropa): código interno, colección + semestre, fecha
     * programada y fecha de entrega estimada.
     */
    public function up(): void
    {
        Schema::table('mfg_production_orders', function (Blueprint $table) {
            $table->string('internalCode')->nullable()->after('code');
            $table->foreignId('collectionId')->nullable()->after('referenceId')
                ->constrained('mfg_collections')->nullOnDelete();
            $table->string('semester')->nullable()->after('collectionId'); // I | II
            $table->timestamp('scheduledAt')->nullable()->after('notes');
            $table->timestamp('estimatedDeliveryAt')->nullable()->after('scheduledAt');
        });
    }

    public function down(): void
    {
        Schema::table('mfg_production_orders', function (Blueprint $table) {
            $table->dropColumn(['internalCode', 'semester', 'scheduledAt', 'estimatedDeliveryAt']);
            $table->dropConstrainedForeignId('collectionId');
        });
    }
};
