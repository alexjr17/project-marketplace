<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Color de fondo/texto propio para el anuncio (override del estilo/marca). */
    public function up(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->string('bgColor')->nullable()->after('variant');
            $table->string('textColor')->nullable()->after('bgColor');
        });
    }

    public function down(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropColumn(['bgColor', 'textColor']);
        });
    }
};
