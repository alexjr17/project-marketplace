<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Chat para pulir un modelo 3D: cada mensaje es una instrucción ("más ancha", "sin logo") que la IA
     * aplica sobre la foto base; con la foto que quede bien se vuelve a generar el 3D.
     */
    public function up(): void
    {
        if (Schema::hasTable('mannequin_model_edits')) {
            return;
        }
        Schema::create('mannequin_model_edits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('modelId')->constrained('mannequin_models')->cascadeOnDelete();
            $table->text('prompt');
            // procesando | listo | error
            $table->string('status', 20)->default('procesando');
            $table->string('basePath')->nullable();
            $table->string('imagePath')->nullable();
            $table->text('error')->nullable();
            $table->unsignedTinyInteger('account')->nullable();
            $table->unsignedInteger('seconds')->nullable();
            // Primer mensaje: arma la foto base estándar (producto en el maniquí de su tipo).
            $table->boolean('initial')->default(false);
            // Esta foto se usó para generar el 3D actual.
            $table->boolean('applied')->default(false);
            $table->foreignId('createdBy')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mannequin_model_edits');
    }
};
