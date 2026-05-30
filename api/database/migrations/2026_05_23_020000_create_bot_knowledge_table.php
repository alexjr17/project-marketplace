<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Base de conocimiento del bot del Inbox.
 * Cada entrada es un "fact" o instrucción agrupada por categoría que se
 * inyecta en el system prompt del LLM antes de responder, dándole contexto
 * sobre el negocio sin necesidad de re-entrenar el modelo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bot_knowledge', function (Blueprint $table) {
            $table->id();
            // business | tone | fabrics | sizing | colors | shipping |
            // returns | payments | faq | sales | other
            $table->string('category', 30);
            $table->string('title');
            $table->text('content');
            $table->boolean('isActive')->default(true);
            $table->unsignedInteger('sortOrder')->default(0);
            $table->timestamp('createdAt')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();
            $table->index(['category', 'isActive', 'sortOrder']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bot_knowledge');
    }
};
