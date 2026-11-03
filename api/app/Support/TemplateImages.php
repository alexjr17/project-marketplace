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
}
