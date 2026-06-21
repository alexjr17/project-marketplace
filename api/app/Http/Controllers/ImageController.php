<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Support\ImageUrls;
use Illuminate\Http\Request;

/**
 * Sirve las imágenes de producto (almacenadas como data URI en la BD) por una
 * URL cacheable, redimensionadas y comprimidas para no inlinear base64 ni
 * mandar PNG enormes en cada respuesta.
 */
class ImageController extends Controller
{
    public function show(Request $request, string $type, int $id, string $slot)
    {
        if (! in_array($slot, ImageUrls::SLOTS, true)) {
            abort(404);
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

        // Si ya es una URL externa, redirigir.
        if (preg_match('#^https?://#i', $val)) {
            return redirect()->away($val);
        }

        // data URI -> decodificar.
        if (! preg_match('#^data:([^;]+);base64,(.+)$#s', $val, $m)) {
            abort(404);
        }
        $bytes = base64_decode($m[2], true);
        if ($bytes === false) {
            abort(404);
        }

        $width = (int) $request->query('w', 1000);
        $width = max(50, min(1600, $width));

        [$out, $mime] = $this->optimize($bytes, $m[1], $width);

        return response($out, 200)
            ->header('Content-Type', $mime)
            ->header('Content-Length', (string) strlen($out))
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
        $mime = $originalMime;
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
