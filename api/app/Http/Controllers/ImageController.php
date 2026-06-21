<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Support\ImageUrls;

/**
 * Sirve las imágenes de producto (almacenadas como data URI en la BD) por una
 * URL cacheable, para no inlinear base64 en cada respuesta JSON.
 */
class ImageController extends Controller
{
    public function show(string $type, int $id, string $slot)
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

        // data URI -> decodificar y servir los bytes.
        if (! preg_match('#^data:([^;]+);base64,(.+)$#s', $val, $m)) {
            abort(404);
        }
        $bytes = base64_decode($m[2], true);
        if ($bytes === false) {
            abort(404);
        }

        return response($bytes, 200)
            ->header('Content-Type', $m[1])
            ->header('Content-Length', (string) strlen($bytes))
            ->header('Cache-Control', 'public, max-age=31536000, immutable');
    }
}
