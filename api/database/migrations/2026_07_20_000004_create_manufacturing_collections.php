<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Colecciones de la app Fábrica (año + semestre). La referencia pertenece
     * a una colección. CRUD propio como los demás catálogos.
     */
    public function up(): void
    {
        Schema::create('mfg_collections', function (Blueprint $table) {
            $table->id();
            $table->string('name');                       // "Verano 2026", "2026-I"…
            $table->integer('year')->nullable();
            $table->string('semester')->nullable();       // I | II
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::table('mfg_references', function (Blueprint $table) {
            $table->foreignId('collectionId')->nullable()->after('garmentTypeId')
                ->constrained('mfg_collections')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('mfg_references', function (Blueprint $table) {
            $table->dropConstrainedForeignId('collectionId');
        });
        Schema::dropIfExists('mfg_collections');
    }
};
