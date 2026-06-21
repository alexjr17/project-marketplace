<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Diseño del popup (standard | image | overlay) y tamaño (sm | md | lg | xl). */
    public function up(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->string('layout')->nullable()->default('standard')->after('type');
            $table->string('size')->nullable()->default('md')->after('layout');
        });
    }

    public function down(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropColumn(['layout', 'size']);
        });
    }
};
