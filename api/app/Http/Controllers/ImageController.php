<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Support\ImageUrls;
use Illuminate\Http\Request;

/**
 * Sirve las imágenes de producto (data URI en la BD) por una URL cacheable,
 * redimensionadas/comprimidas (WebP o JPEG) y con caché en disco para no
 * redecodificar base64 ni reprocesar con GD en cada petición.
 */
class ImageController extends Controller
{
    public function show(Request $request, string $type, int $id, string $slot)
    {
        if (! in_array($slot, ImageUrls::SLOTS, true)) {
            abort(404);
        }

        $width = max(50, min(1600, (int) $request->query('w', 1000)));
        $v = preg_replace('/[^A-Za-z0-9]/', '', (string) $request->query('v', 'x')) ?: 'x';
        $key = "{$type}-{$id}-{$slot}-{$width}-{$v}";
        $dir = storage_path('app/imgcache');

        // Cache hit: servir sin tocar la BD ni GD.
        foreach (['webp' => 'image/webp', 'jpg' => 'image/jpeg'] as $ext => $mime) {
            $path = "{$dir}/{$key}.{$ext}";
            if (is_file($path)) {
                return $this->imageResponse((string) file_get_contents($path), $mime);
            }
        }

        // Templates son productos (isTemplate); ambos viven en la tabla products.
        $model = $type === 'product' ? Product::find($id) : null;
        if (! $model) {
            abort(404);
        }

        $val = ImageUrls::slotValue($model->images, $slot);
        if (! $val) {
            abort(404);
        }

        if (preg_match('#^https?://#i', $val)) {
            return redirect()->away($val);
        }

        if (! preg_match('#^data:([^;]+);base64,(.+)$#s', $val, $m)) {
            abort(404);
        }
        $bytes = base64_decode($m[2], true);
        if ($bytes === false) {
            abort(404);
        }

        [$out, $mime] = $this->optimize($bytes, $m[1], $width);

        // Guardar en caché (disco efímero: se regenera tras cada deploy).
        if (! is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $ext = $mime === 'image/webp' ? 'webp' : 'jpg';
        @file_put_contents("{$dir}/{$key}.{$ext}", $out);

        return $this->imageResponse($out, $mime);
    }

    private function imageResponse(string $bytes, string $mime)
    {
        return response($bytes, 200)
            ->header('Content-Type', $mime)
            ->header('Content-Length', (string) strlen($bytes))
            ->header('Cache-Control', 'public, max-age=31536000, immutable');
    }

    /**
     * Redimensiona (máx. $maxW de ancho) y comprime a WebP/JPEG con GD.
     * Si GD no está disponible o falla, devuelve los bytes originales.
     *
     * @return array{0:string,1:string} [bytes, mimeType]
     */
    private function optimize(string $bytes, string $originalMime, int $maxW): array
    {
        if (! function_exists('imagecreatefromstring')) {
            return [$bytes, $originalMime];
        }

        $src = @imagecreatefromstring($bytes);
        if ($src === false) {
            return [$bytes, $originalMime];
        }

        $w = imagesx($src);
        $h = imagesy($src);

        if ($w > $maxW) {
            $nh = (int) max(1, round($h * $maxW / $w));
            $dst = imagecreatetruecolor($maxW, $nh);
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
            imagecopyresampled($dst, $src, 0, 0, 0, 0, $maxW, $nh, $w, $h);
            imagedestroy($src);
            $src = $dst;
        }

        ob_start();
        if (function_exists('imagewebp')) {
            imagewebp($src, null, 80);
            $mime = 'image/webp';
        } else {
            imagejpeg($src, null, 80);
            $mime = 'image/jpeg';
        }
        $out = ob_get_clean();
        imagedestroy($src);

        return $out !== false && $out !== '' ? [$out, $mime] : [$bytes, $originalMime];
    }
}
