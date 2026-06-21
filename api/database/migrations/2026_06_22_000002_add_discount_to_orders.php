<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Enlaza el cupón usado con la orden (para reportes y para contar usos
     * por usuario). El monto del descuento ya existe en orders.discount.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedBigInteger('discountId')->nullable()->after('discount');
            $table->string('couponCode')->nullable()->after('discountId');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['discountId', 'couponCode']);
        });
    }
};
