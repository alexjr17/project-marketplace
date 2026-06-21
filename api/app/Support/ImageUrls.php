<?php

namespace App\Support;

/**
 * Construye URLs de imágenes servibles (cacheables) a partir del campo
 * `images` de un producto. Las imágenes embebidas (data URI base64) se exponen
 * por un endpoint cacheable (/api/img/...) en vez de inlinearse en el JSON;
 * las que ya son URL http(s) se devuelven tal cual.
 */
class ImageUrls
{
    public const SLOTS = ['front', 'back', 'side', 'extra1', 'extra2'];

    /** Decodifica el campo images a array (soporta JSON string). */
    private static function toArray($images): array
    {
        if (is_string($images)) {
            $decoded = json_decode($images, true);

            return is_array($decoded) ? $decoded : [];
        }

        return is_array($images) ? $images : [];
    }

    /** Valor crudo (data URI o URL) de un slot; soporta {front,...} y lista [0..]. */
    public static function slotValue($images, string $slot): ?string
    {
        $images = self::toArray($images);

        if (is_string($images[$slot] ?? null) && $images[$slot] !== '') {
            return $images[$slot];
        }
        $idx = array_search($slot, self::SLOTS, true);
        if ($idx !== false && is_string($images[$idx] ?? null) && $images[$idx] !== '') {
            return $images[$idx];
        }

        return null;
    }

    /** URL servible de una imagen suelta por color (product_colors.image). */
    public static function forColor(?string $image, int $productColorId, $version = null): ?string
    {
        if (! is_string($image) || $image === '') {
            return null;
        }
        if (preg_match('#^https?://#i', $image)) {
            return $image;
        }
        $v = $version instanceof \DateTimeInterface ? $version->getTimestamp() : (is_numeric($version) ? (int) $version : 0);

        return url("api/img/color/{$productColorId}/front").($v ? "?v={$v}" : '');
    }

    /** {front,back,side,extra1,extra2} con URLs servibles. */
    public static function forModel($images, string $type, int $id, $version = null): array
    {
        $v = 0;
        if ($version instanceof \DateTimeInterface) {
            $v = $version->getTimestamp();
        } elseif (is_numeric($version)) {
            $v = (int) $version;
        }

        $out = [];
        foreach (self::SLOTS as $slot) {
            $val = self::slotValue($images, $slot);
            if ($val === null) {
                $out[$slot] = $slot === 'front' ? '' : null;

                continue;
            }
            if (preg_match('#^https?://#i', $val)) {
                $out[$slot] = $val;
            } else {
                $out[$slot] = url("api/img/{$type}/{$id}/{$slot}").($v ? "?v={$v}" : '');
            }
        }

        return $out;
    }
}
