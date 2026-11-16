<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fondo de la foto del producto en la tienda (productos y plantillas personalizables): la imagen de
     * fondo, la foto principal recortada y la huella de la foto con la que se recortó.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('products', 'backdrop')) {
            Schema::table('products', function (Blueprint $table) {
                $table->json('backdrop')->nullable()->after('images');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('products', 'backdrop')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('backdrop');
            });
        }
    }
};
