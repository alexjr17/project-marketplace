<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Soporte para varias imágenes por publicación (carrusel).
 * El campo `mediaUrl` (string única) se mantiene por compatibilidad — siempre
 * guardamos también la primera imagen ahí para listados antiguos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('social_posts', function (Blueprint $table) {
            $table->json('mediaUrls')->nullable()->after('mediaUrl');
        });
    }

    public function down(): void
    {
        Schema::table('social_posts', function (Blueprint $table) {
            $table->dropColumn('mediaUrls');
        });
    }
};
