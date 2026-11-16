<?php

namespace App\Support;

/**
 * Imágenes base de una plantilla personalizable, siempre como {front, back, side}.
 * Acepta el objeto {front, back, side} y la lista que guardaba el admin antes
 * ([0] = frente, [1] = espalda, [2] = lado). Lo que falte queda en cadena vacía.
 */
class TemplateImages
{
    /** @return array{front: string, back: string, side: string} */
    public static function normalize(mixed $images): array
    {
        if (is_string($images)) {
            $decoded = json_decode($images, true);
            $images = is_array($decoded) ? $decoded : [];
        }
        $images = is_array($images) ? $images : [];
        $pick = function (string $key, int $index) use ($images): string {
            $value = $images[$key] ?? ($images[$index] ?? '');

            return is_string($value) ? $value : '';
        };

        return [
            'front' => $pick('front', 0),
            'back' => $pick('back', 1),
            'side' => $pick('side', 2),
        ];
    }

    /**
     * Imágenes de la plantilla tal como se muestran: las de sus zonas (Frente, Espalda, Mangas… del
     * editor de zonas) y, si una vista no tiene, la foto vieja de esa vista.
     *
     * @return array{front: string, back: string, side: string}
     */
    public static function withZones(mixed $images, mixed $zoneTypeImages): array
    {
        $base = self::normalize($images);
        if (is_string($zoneTypeImages)) {
            $zoneTypeImages = json_decode($zoneTypeImages, true);
        }
        $zones = array_filter(is_array($zoneTypeImages) ? $zoneTypeImages : [], fn ($v) => is_string($v) && $v !== '');
        $find = function (string $pattern) use ($zones): string {
            foreach ($zones as $slug => $url) {
                if (preg_match($pattern, (string) $slug)) {
                    return $url;
                }
            }

            return '';
        };

        return [
            'front' => $find('/^(frente|front|delantero|pecho)/i') ?: ($base['front'] ?: (string) (reset($zones) ?: '')),
            'back' => $find('/^(espalda|back|trasero)/i') ?: $base['back'],
            'side' => $find('/(manga|lado|side|sleeve)/i') ?: $base['side'],
        ];
    }
}
