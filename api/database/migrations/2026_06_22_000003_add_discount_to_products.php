<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Descuento directo sobre el producto (precio de oferta), sin necesidad
     * de cupón. El precio efectivo se calcula a partir de basePrice.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('discountType')->default('none')->after('basePrice'); // none | percent | fixed
            $table->decimal('discountValue', 10, 2)->default(0)->after('discountType');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['discountType', 'discountValue']);
        });
    }
};
