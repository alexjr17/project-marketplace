<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Maniquí 3D de cada plantilla personalizable (products.model3d: 'basica' | 'oversize'; null =
     * editor con fotos) y la configuración por defecto de las dos plantillas de suéter:
     *  - Suéter básico → maniquí "basica"; suéter oversize → "oversize".
     *  - Zonas de frente, espalda y las dos mangas, en % del escenario de cada vista del maniquí
     *    (ver web/src/components/mannequin/models.ts). Las de frente y espalda que aún tienen la
     *    posición de la semilla (pensada para fotos) se reubican; las mangas se crean si faltan.
     *  - Fotos de prueba rotas (loremflickr) se quitan: la tienda muestra la foto del maniquí.
     * Idempotente: solo toca lo que falta o lo que sigue con los valores de la semilla.
     */
    private const SEED_AREA = ['positionX' => 22, 'positionY' => 18, 'maxWidth' => 56, 'maxHeight' => 72];

    /** Zonas por maniquí: [slug del tipo de zona, nombre, x, y, ancho, alto, precio, obligatoria, orden]. */
    private const ZONES = [
        'basica' => [
            ['frente', 'Frente', 36, 28, 28, 30, 8000, true, 1],
            ['espalda', 'Espalda', 36, 28, 28, 34, 8000, false, 2],
            ['manga-derecha', 'Manga derecha', 39, 30, 12, 11, 4000, false, 3],
            ['manga-izquierda', 'Manga izquierda', 39, 30, 12, 11, 4000, false, 4],
        ],
        'oversize' => [
            ['frente', 'Frente', 35, 28, 30, 34, 8000, true, 1],
            ['espalda', 'Espalda', 35, 28, 30, 36, 8000, false, 2],
            ['manga-derecha', 'Manga derecha', 41, 37, 14, 12, 4000, false, 3],
            ['manga-izquierda', 'Manga izquierda', 41, 37, 14, 12, 4000, false, 4],
        ],
    ];

    private const TYPE_MODEL = ['sueter-basico' => 'basica', 'sueter-oversize' => 'oversize'];

    public function up(): void
    {
        if (! Schema::hasColumn('products', 'model3d')) {
            Schema::table('products', function (Blueprint $table) {
                $table->string('model3d', 20)->nullable()->after('isTemplate');
            });
        }
        if (! Schema::hasTable('template_zones') || ! Schema::hasTable('zone_types')) {
            return;
        }

        $zoneTypes = DB::table('zone_types')->pluck('id', 'slug');
        $now = now();

        foreach (self::TYPE_MODEL as $typeSlug => $model) {
            $typeId = DB::table('product_types')->where('slug', $typeSlug)->value('id');
            if (! $typeId) {
                continue;
            }
            $templates = DB::table('products')->where('isTemplate', true)->where('typeId', $typeId)->get(['id', 'model3d', 'images']);
            foreach ($templates as $template) {
                if ($template->model3d === null) {
                    DB::table('products')->where('id', $template->id)->update(['model3d' => $model]);
                }
                if (is_string($template->images) && str_contains($template->images, 'loremflickr.com')) {
                    DB::table('products')->where('id', $template->id)->update(['images' => json_encode(['front' => '', 'back' => '', 'side' => ''])]);
                }

                foreach (self::ZONES[$model] as [$slug, $name, $x, $y, $w, $h, $price, $required, $order]) {
                    $zoneTypeId = $zoneTypes[$slug] ?? null;
                    if (! $zoneTypeId) {
                        continue;
                    }
                    $area = ['positionX' => $x, 'positionY' => $y, 'maxWidth' => $w, 'maxHeight' => $h];
                    $existing = DB::table('template_zones')->where('templateId', $template->id)->where('zoneTypeId', $zoneTypeId)->get();
                    if ($existing->isEmpty()) {
                        DB::table('template_zones')->insert($area + [
                            'templateId' => $template->id,
                            'zoneTypeId' => $zoneTypeId,
                            'zoneId' => 'zone-'.$slug,
                            'name' => $name,
                            'shape' => 'rect',
                            'isEditable' => true,
                            'isRequired' => $required,
                            'isBlocked' => false,
                            'price' => $price,
                            'sortOrder' => $order,
                            'isActive' => true,
                            'createdAt' => $now,
                            'updatedAt' => $now,
                        ]);

                        continue;
                    }
                    foreach ($existing as $zone) {
                        $seed = true;
                        foreach (self::SEED_AREA as $col => $value) {
                            $seed = $seed && (float) $zone->{$col} === (float) $value;
                        }
                        if ($seed) {
                            DB::table('template_zones')->where('id', $zone->id)->update($area + ['updatedAt' => $now]);
                        }
                    }
                }
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('products', 'model3d')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('model3d');
            });
        }
    }
};
