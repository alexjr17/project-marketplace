<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const COLUMNS = ['positionX', 'positionY', 'maxWidth', 'maxHeight', 'radius'];

    /**
     * Las zonas de las plantillas se guardan en porcentaje (0-100) sobre la imagen de la vista,
     * que es como las pinta el personalizador y el editor visual. Las columnas eran enteras
     * (se perdían los decimales al mover una zona) y la semilla las guardaba en píxeles.
     *
     * 1) Columnas a decimal(6,2).
     * 2) Filas con algún valor > 100 (en píxeles): se pasan a porcentaje con la referencia de
     *    500 px de la semilla (valor / 5) y se ajustan para que la zona no se salga de la imagen.
     * Idempotente: tras la conversión ningún valor supera 100.
     */
    public function up(): void
    {
        if (! Schema::hasTable('template_zones')) {
            return;
        }

        Schema::table('template_zones', function (Blueprint $table) {
            $table->decimal('maxWidth', 6, 2)->default(0)->change();
            $table->decimal('maxHeight', 6, 2)->default(0)->change();
            $table->decimal('positionX', 6, 2)->default(0)->change();
            $table->decimal('positionY', 6, 2)->default(0)->change();
            $table->decimal('radius', 6, 2)->nullable()->change();
        });

        $rows = DB::table('template_zones')
            ->where(function ($q) {
                foreach (self::COLUMNS as $col) {
                    $q->orWhere($col, '>', 100);
                }
            })
            ->get(['id', ...self::COLUMNS]);

        foreach ($rows as $row) {
            $w = min(100, round((float) $row->maxWidth / 5, 2));
            $h = min(100, round((float) $row->maxHeight / 5, 2));
            $x = max(0, min(100 - $w, round((float) $row->positionX / 5, 2)));
            $y = max(0, min(100 - $h, round((float) $row->positionY / 5, 2)));

            DB::table('template_zones')->where('id', $row->id)->update([
                'maxWidth' => $w,
                'maxHeight' => $h,
                'positionX' => $x,
                'positionY' => $y,
                'radius' => $row->radius === null ? null : min(50, round((float) $row->radius / 5, 2)),
            ]);
        }
    }

    public function down(): void
    {
        // Sin vuelta atrás de los datos: los porcentajes son el formato correcto.
        // Las columnas vuelven a enteras (se redondean los decimales).
        if (! Schema::hasTable('template_zones')) {
            return;
        }
        Schema::table('template_zones', function (Blueprint $table) {
            $table->integer('maxWidth')->change();
            $table->integer('maxHeight')->change();
            $table->integer('positionX')->change();
            $table->integer('positionY')->change();
            $table->integer('radius')->nullable()->change();
        });
    }
};
