<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Maniquíes 3D generados desde el admin (Modelos 3D). Los dos del sistema (basica, oversize)
     * siguen en el código; aquí van los nuevos, con su estado de generación:
     * generando → revision (listo para revisar, aún no se elige en plantillas) → publicado; o error.
     * `key` es lo que guarda products.model3d (máx. 20).
     */
    public function up(): void
    {
        if (Schema::hasTable('mannequin_models')) {
            return;
        }
        Schema::create('mannequin_models', function (Blueprint $table) {
            $table->id();
            $table->string('key', 20)->nullable()->unique();
            $table->string('name', 80);
            $table->string('status', 20)->default('generando')->index();
            // foto | vistas | texto
            $table->string('source', 10);
            $table->text('prompt')->nullable();
            $table->json('inputImages')->nullable();
            $table->string('quality', 10)->default('normal');
            $table->string('glbPath')->nullable();
            $table->string('posterPath')->nullable();
            $table->json('config')->nullable();
            $table->text('error')->nullable();
            // Cuenta de Hugging Face que lo generó (1 = HF_TOKEN, 2 = HF_TOKEN_2…).
            $table->unsignedTinyInteger('account')->nullable();
            $table->unsignedInteger('seconds')->nullable();
            $table->timestamp('startedAt')->nullable();
            $table->timestamp('finishedAt')->nullable();
            $table->foreignId('createdBy')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mannequin_models');
    }
};
