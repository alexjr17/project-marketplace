<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Módulo de publicidad/anuncios de la tienda: barra superior, popup,
     * marquesina y tarjeta flotante. Programables, segmentables y con cupón.
     */
    public function up(): void
    {
        Schema::create('announcements', function (Blueprint $table) {
            $table->id();
            $table->string('type')->default('bar');      // bar | popup | marquee | floating
            $table->string('title')->nullable();
            $table->text('message')->nullable();
            $table->longText('imageUrl')->nullable();     // popup (puede ser URL o data URI)
            $table->string('ctaText')->nullable();
            $table->string('ctaUrl')->nullable();
            $table->string('couponCode')->nullable();
            $table->string('variant')->default('info');   // info | promo | warning | success | dark
            $table->boolean('isActive')->default(true);
            $table->boolean('dismissible')->default(true);
            $table->string('target')->default('all');     // all | home | catalog
            $table->string('frequency')->default('always'); // always | session | daily
            $table->integer('priority')->default(0);
            $table->dateTime('startsAt')->nullable();
            $table->dateTime('endsAt')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('announcements');
    }
};
