<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Categorías editables del módulo "Entrenar IA".
 * La tabla bot_knowledge solo guarda el slug (string) — no usamos FK para que
 * borrar una categoría no rompa las entradas existentes (quedan huérfanas y
 * caen en "Otra información" hasta que el admin las re-categorice).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bot_knowledge_categories', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 50)->unique();
            $table->string('label', 120);
            $table->string('description', 250)->nullable();
            $table->string('emoji', 10)->nullable();
            $table->string('color', 30)->nullable(); // 'blue', 'purple', 'amber', etc.
            $table->unsignedInteger('sortOrder')->default(0);
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();
            $table->index(['isActive', 'sortOrder']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bot_knowledge_categories');
    }
};
