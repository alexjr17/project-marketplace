<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Proyectos del estudio de contenido (app Social): el trabajo en curso de un post o un video con
     * todo lo armado (qué se muestra, plantilla, capas, escenas, textos, colores y zonas), para volver
     * a abrirlo y seguir editándolo. Las piezas terminadas siguen yendo a marketing_creatives.
     */
    public function up(): void
    {
        if (Schema::hasTable('marketing_projects')) {
            return;
        }
        Schema::create('marketing_projects', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            // post | video360 | reel
            $table->string('format', 12);
            // producto | coleccion | promocion | diseno | plantilla | libre
            $table->string('source', 12)->default('libre');
            $table->string('template', 30)->nullable();
            $table->string('thumbPath')->nullable();
            $table->json('data');
            $table->foreignId('createdBy')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updatedBy')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('updatedAt');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_projects');
    }
};
