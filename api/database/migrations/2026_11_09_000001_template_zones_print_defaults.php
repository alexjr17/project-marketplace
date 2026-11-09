<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Zonas de estampado por defecto de las plantillas con maniquí 3D, medidas sobre el maniquí:
     *  - Frente y espalda al ~70 % del ancho del torso (antes casi del ancho completo: el diseño
     *    envolvía los costados) y con proporción de estampado real (~30 × 40 cm).
     *  - Mangas centradas en cada manga y espejadas: en la vista de la manga izquierda la imagen sale
     *    al revés que en la derecha (antes las dos tenían la misma posición y la izquierda caía fuera).
     * Solo se actualizan las zonas que siguen con los valores por defecto anteriores (las ajustadas a
     * mano en el admin no se tocan). Idempotente.
     */
    private const OLD = [
        'basica' => [
            'frente' => [36, 28, 28, 30], 'espalda' => [36, 28, 28, 34],
            'manga-derecha' => [41, 29, 9, 9], 'manga-izquierda' => [41, 29, 9, 9],
        ],
        'oversize' => [
            'frente' => [35, 28, 30, 34], 'espalda' => [35, 28, 30, 36],
            'manga-derecha' => [44, 38, 9, 10], 'manga-izquierda' => [44, 38, 9, 10],
        ],
    ];

    private const NEW = [
        'basica' => [
            'frente' => [41, 32, 18, 24], 'espalda' => [41, 31, 18, 28],
            'manga-derecha' => [41, 29, 10, 10], 'manga-izquierda' => [49, 29, 10, 10],
        ],
        'oversize' => [
            'frente' => [39.5, 32, 21, 28], 'espalda' => [39.5, 31, 21, 32],
            'manga-derecha' => [39.5, 32, 11, 12], 'manga-izquierda' => [49.5, 32, 11, 12],
        ],
    ];

    /** Cada maniquí v2 usa las mismas zonas que su versión 1 (es el mismo maniquí). */
    private const FAMILY = ['basica' => 'basica', 'basica_v2' => 'basica', 'oversize' => 'oversize', 'oversize_v2' => 'oversize'];

    public function up(): void
    {
        if (! Schema::hasColumn('products', 'model3d') || ! Schema::hasTable('template_zones')) {
            return;
        }
        $zoneTypes = DB::table('zone_types')->pluck('id', 'slug');
        $templates = DB::table('products')->where('isTemplate', true)->whereIn('model3d', array_keys(self::FAMILY))->get(['id', 'model3d']);

        foreach ($templates as $template) {
            $family = self::FAMILY[$template->model3d];
            foreach (self::NEW[$family] as $slug => [$x, $y, $w, $h]) {
                $zoneTypeId = $zoneTypes[$slug] ?? null;
                if (! $zoneTypeId) {
                    continue;
                }
                [$ox, $oy, $ow, $oh] = self::OLD[$family][$slug];
                DB::table('template_zones')
                    ->where('templateId', $template->id)
                    ->where('zoneTypeId', $zoneTypeId)
                    ->where('positionX', $ox)->where('positionY', $oy)->where('maxWidth', $ow)->where('maxHeight', $oh)
                    ->update(['positionX' => $x, 'positionY' => $y, 'maxWidth' => $w, 'maxHeight' => $h, 'updatedAt' => now()]);
            }
        }
    }

    public function down(): void
    {
        // Sin vuelta atrás automática: los valores anteriores dejaban el diseño fuera de la prenda.
    }
};
