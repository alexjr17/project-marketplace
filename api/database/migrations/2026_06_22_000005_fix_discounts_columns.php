<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Reconcilia la tabla discounts en bases que ya la habían creado con el
     * esquema viejo (sin isAuto y con code NOT NULL). La migración original
     * fue editada, por lo que no vuelve a ejecutarse; esta sí.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('discounts', 'isAuto')) {
            Schema::table('discounts', function (Blueprint $table) {
                $table->boolean('isAuto')->default(false)->after('code');
            });
        }

        // code pasa a ser opcional (descuentos automáticos no llevan código).
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE discounts ALTER COLUMN code DROP NOT NULL');
        } elseif ($driver === 'mysql') {
            DB::statement('ALTER TABLE discounts MODIFY code VARCHAR(255) NULL');
        }
        // sqlite crea las columnas como nullable por defecto: no requiere cambio.
    }

    public function down(): void
    {
        // No se revierte el nullable de code para no perder datos.
        if (Schema::hasColumn('discounts', 'isAuto')) {
            Schema::table('discounts', function (Blueprint $table) {
                $table->dropColumn('isAuto');
            });
        }
    }
};
