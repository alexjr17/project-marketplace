<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Zonas por defecto de los maniquíes con patrón de costura: medidas sobre las piezas del
     * patrón, cada zona cabe entera en su pieza (frente, espalda, manga der., manga izq.) y el estampado
     * no cruza una costura. Solo se actualizan las zonas que siguen con algún valor por defecto anterior;
     * las ajustadas a mano en el admin no se tocan. Idempotente.
     */
    private const PREVIOUS = [
        'basica' => [
            'frente' => [[36, 28, 28, 30], [41, 32, 18, 24]],
            'espalda' => [[36, 28, 28, 34], [41, 31, 18, 28]],
            'manga-derecha' => [[41, 29, 9, 9], [41, 29, 10, 10]],
            'manga-izquierda' => [[41, 29, 9, 9], [49, 29, 10, 10]],
        ],
        'oversize' => [
            'frente' => [[35, 28, 30, 34], [39.5, 32, 21, 28]],
            'espalda' => [[35, 28, 30, 36], [39.5, 31, 21, 32]],
            'manga-derecha' => [[44, 38, 9, 10], [39.5, 32, 11, 12]],
            'manga-izquierda' => [[44, 38, 9, 10], [49.5, 32, 11, 12]],
        ],
    ];

    private const V2 = [
        'basica' => [
            'frente' => [40.8, 32, 18, 22.4], 'espalda' => [41.2, 31, 17.6, 23.6],
            'manga-derecha' => [41.2, 32.2, 10.5, 10.5], 'manga-izquierda' => [47.8, 32.5, 10, 10],
        ],
        'oversize' => [
            'frente' => [40, 32, 19.6, 24.4], 'espalda' => [39.2, 31, 21.6, 28.8],
            'manga-derecha' => [43.5, 38, 8.5, 8.5], 'manga-izquierda' => [50.7, 38.2, 7.5, 7.5],
        ],
    ];

    /** Los v2 son ahora los oficiales ('basica', 'oversize'); se incluyen también las claves v2 por si quedó alguna. */
    private const FAMILY = ['basica' => 'basica', 'oversize' => 'oversize', 'basica_v2' => 'basica', 'oversize_v2' => 'oversize'];

    public function up(): void
    {
        if (! Schema::hasColumn('products', 'model3d') || ! Schema::hasTable('template_zones')) {
            return;
        }
        $zoneTypes = DB::table('zone_types')->pluck('id', 'slug');
        $templates = DB::table('products')->where('isTemplate', true)->whereIn('model3d', array_keys(self::FAMILY))->get(['id', 'model3d']);

        foreach ($templates as $template) {
            $family = self::FAMILY[$template->model3d];
            foreach (self::V2[$family] as $slug => [$x, $y, $w, $h]) {
                $zoneTypeId = $zoneTypes[$slug] ?? null;
                if (! $zoneTypeId) {
                    continue;
                }
                foreach (self::PREVIOUS[$family][$slug] as [$ox, $oy, $ow, $oh]) {
                    DB::table('template_zones')
                        ->where('templateId', $template->id)->where('zoneTypeId', $zoneTypeId)
                        ->where('positionX', $ox)->where('positionY', $oy)->where('maxWidth', $ow)->where('maxHeight', $oh)
                        ->update(['positionX' => $x, 'positionY' => $y, 'maxWidth' => $w, 'maxHeight' => $h, 'updatedAt' => now()]);
                }
            }
        }
    }

    public function down(): void
    {
        // Sin vuelta atrás: las zonas anteriores cruzaban costuras del patrón.
    }
};
