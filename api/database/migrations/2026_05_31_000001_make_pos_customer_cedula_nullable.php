<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Permite clientes POS sin cédula (registro rápido solo por nombre, p. ej.
 * fiados). La columna sigue siendo UNIQUE: en Postgres se permiten múltiples
 * NULL, así que varios clientes sin cédula no chocan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pos_customers', function (Blueprint $table) {
            $table->string('cedula')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('pos_customers', function (Blueprint $table) {
            $table->string('cedula')->nullable(false)->change();
        });
    }
};
