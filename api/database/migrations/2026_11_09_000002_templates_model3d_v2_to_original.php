<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Los maniquíes v2 pasan a ser los oficiales con las claves de siempre ('basica', 'oversize'): las
     * plantillas que usaban 'basica_v2' / 'oversize_v2' vuelven a la clave original. Idempotente.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('products', 'model3d')) {
            return;
        }
        DB::table('products')->where('model3d', 'basica_v2')->update(['model3d' => 'basica']);
        DB::table('products')->where('model3d', 'oversize_v2')->update(['model3d' => 'oversize']);
    }

    public function down(): void
    {
        // Sin vuelta atrás: las claves v2 ya no existen en la tienda.
    }
};
