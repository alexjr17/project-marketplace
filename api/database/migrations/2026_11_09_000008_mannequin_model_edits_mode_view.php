<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Chat de modelos 3D: qué hace cada mensaje (mode) y, en las 4 vistas para el 3D, cuál es (view).
     *  - text: foto desde la descripción
     *  - base: el producto de una foto de referencia, pasado al maniquí estándar
     *  - edit: un cambio sobre la foto actual
     *  - view: espalda, lado izquierdo o lado derecho de la foto aprobada (view = back|left|right)
     */
    public function up(): void
    {
        Schema::table('mannequin_model_edits', function (Blueprint $table) {
            if (! Schema::hasColumn('mannequin_model_edits', 'mode')) {
                $table->string('mode', 10)->default('edit')->after('prompt');
            }
            if (! Schema::hasColumn('mannequin_model_edits', 'view')) {
                $table->string('view', 10)->nullable()->after('mode');
            }
        });
        DB::table('mannequin_model_edits')->where('initial', true)->whereNull('basePath')->update(['mode' => 'text']);
        DB::table('mannequin_model_edits')->where('initial', true)->whereNotNull('basePath')->update(['mode' => 'base']);
    }

    public function down(): void
    {
        Schema::table('mannequin_model_edits', function (Blueprint $table) {
            $table->dropColumn(['mode', 'view']);
        });
    }
};
