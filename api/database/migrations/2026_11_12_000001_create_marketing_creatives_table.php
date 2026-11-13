<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Estudio de contenido (app Social): piezas para redes armadas en el estudio (imagen de post o
     * historia, reel o video 360° del maniquí) con su texto. Se publican o programan como social_posts.
     */
    public function up(): void
    {
        if (Schema::hasTable('marketing_creatives')) {
            return;
        }
        Schema::create('marketing_creatives', function (Blueprint $table) {
            $table->id();
            $table->string('title', 120);
            // post (1:1) | historia (9:16) | reel (video 9:16) | video360 (maniquí girando)
            $table->string('kind', 12);
            // producto | coleccion | promocion | diseno | plantilla | libre
            $table->string('source', 12)->default('libre');
            $table->json('sourceIds')->nullable();
            $table->string('template', 30)->nullable();
            $table->json('data')->nullable();
            $table->string('mediaPath');
            $table->string('mediaType', 8); // image | video
            $table->text('caption')->nullable();
            $table->json('hashtags')->nullable();
            $table->foreignId('createdBy')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_creatives');
    }
};
