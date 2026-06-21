<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Imagen por color del producto: cuando el cliente elige un color se muestra
     * esta imagen (en la página, carrito, checkout y POS).
     */
    public function up(): void
    {
        Schema::table('product_colors', function (Blueprint $table) {
            $table->longText('image')->nullable()->after('colorId'); // data URI o URL
        });
    }

    public function down(): void
    {
        Schema::table('product_colors', function (Blueprint $table) {
            $table->dropColumn('image');
        });
    }
};
