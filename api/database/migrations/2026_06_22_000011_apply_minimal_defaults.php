<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ajustes de una sola vez sobre la base ya sembrada (sin volver a borrar):
     *  - Correos por defecto genéricos (no personales).
     *  - Solo el anuncio de "Envío gratis" queda activo.
     *  - Stock mínimo: todo en 0 y una sola unidad en la primera variante del Buso.
     */
    public function up(): void
    {
        // 1) Correos por defecto genéricos.
        if (Schema::hasTable('users')) {
            $renames = [
                'alexjose.r.r@gmail.com' => 'admin@vexa.com',
                'alexjose.r.r.17@gmail.com' => 'vendedor@vexa.com',
                'estilovexa@gmail.com' => 'cliente@vexa.com',
                'bystreamergames@gmail.com' => 'pos@vexa.com',
            ];
            foreach ($renames as $old => $new) {
                if (DB::table('users')->where('email', $new)->exists()) {
                    continue; // ya migrado / colisión: no tocar
                }
                DB::table('users')->where('email', $old)->update(['email' => $new]);
            }
        }

        // 2) Solo "Envío gratis" activo.
        if (Schema::hasTable('announcements')) {
            DB::table('announcements')->update(['isActive' => false]);
            DB::table('announcements')->where('title', 'like', '%Envío gratis%')->update(['isActive' => true]);
        }

        // 3) Stock mínimo: todo a 0 y 1 unidad en la primera variante del Buso Clásico.
        if (Schema::hasTable('product_variants')) {
            DB::table('product_variants')->update(['stock' => 0]);
            DB::table('products')->update(['stock' => 0]);

            $busoId = DB::table('products')->where('slug', 'buso-clasico')->value('id');
            if ($busoId) {
                $firstVariant = DB::table('product_variants')
                    ->where('productId', $busoId)->orderBy('id')->value('id');
                if ($firstVariant) {
                    DB::table('product_variants')->where('id', $firstVariant)->update(['stock' => 1]);
                }
            }
        }
    }

    public function down(): void
    {
        // No se revierte (ajuste de datos puntual).
    }
};
