<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tablas de autenticación: roles, usuarios y direcciones.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('description');
            $table->json('permissions');
            $table->boolean('isSystem')->default(false);
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('email')->unique();
            $table->string('passwordHash');
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('cedula')->nullable();
            $table->string('avatar')->nullable();
            $table->foreignId('roleId')->constrained('roles');
            $table->enum('status', ['ACTIVE', 'INACTIVE', 'SUSPENDED'])->default('ACTIVE');
            $table->string('resetToken')->nullable();
            $table->dateTime('resetTokenExp')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::create('addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('userId')->constrained('users')->cascadeOnDelete();
            $table->string('label');
            $table->string('address');
            $table->string('city');
            $table->string('department')->nullable();
            $table->string('postalCode')->nullable();
            $table->string('country')->default('Colombia');
            $table->boolean('isDefault')->default(false);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('addresses');
        Schema::dropIfExists('users');
        Schema::dropIfExists('roles');
    }
};
