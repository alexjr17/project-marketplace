<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Publicaciones que la app Social Media envía a redes sociales.
 * Fase A: Facebook Page (text + photo).
 * Fase B: Instagram, programación, multi-plataforma simultánea.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('channelId')->constrained('channels')->cascadeOnDelete();
            $table->string('platform', 20); // facebook | instagram (futuro)
            $table->string('type', 20)->default('text'); // text | photo (futuro: video, link, carousel)
            $table->text('content')->nullable(); // caption/texto
            $table->string('mediaUrl', 1000)->nullable();
            $table->string('status', 20)->default('draft'); // draft | scheduled | published | failed
            $table->timestamp('scheduledAt')->nullable();
            $table->timestamp('publishedAt')->nullable();
            $table->string('externalId')->nullable(); // ID que devuelve Meta tras publicar
            $table->string('externalUrl', 1000)->nullable(); // permalink
            $table->text('error')->nullable();
            $table->foreignId('createdByUserId')->nullable()->constrained('users')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamp('createdAt')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();
            $table->index(['platform', 'status']);
            $table->index('scheduledAt');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_posts');
    }
};
