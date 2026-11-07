<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Settings\ImageUploadService;
use App\Support\SafeRemoteFetch;
use Illuminate\Http\Request;

/**
 * Subida de imágenes a almacenamiento local (public/uploads). El guardado y sus reglas
 * están en ImageUploadService; aquí se recibe el archivo y se responde.
 */
class UploadController extends Controller
{
    use ApiResponse;

    public function __construct(private ImageUploadService $uploads) {}

    /** POST /api/uploads/image */
    public function uploadImage(Request $request)
    {
        if (! $request->hasFile('image')) {
            return $this->error('No se proporcionó ninguna imagen', 400);
        }

        try {
            $result = $this->uploads->store(
                file_get_contents($request->file('image')->getRealPath()),
                $request->input('folder'),
                $request->input('publicId'),
            );
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return $this->created($result, 'Imagen subida exitosamente');
    }

    /** POST /api/uploads/images */
    public function uploadMultipleImages(Request $request)
    {
        $files = $request->file('images');
        if (empty($files)) {
            return $this->error('No se proporcionaron imágenes', 400);
        }

        $results = [];
        try {
            foreach ((array) $files as $file) {
                $results[] = $this->uploads->store(file_get_contents($file->getRealPath()), $request->input('folder'), null);
            }
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return $this->created($results, count($results).' imagen(es) subida(s) exitosamente');
    }

    /** POST /api/uploads/from-url */
    public function uploadFromUrl(Request $request)
    {
        $data = $request->validate([
            'url' => 'required|url',
            'folder' => 'nullable|string',
            'publicId' => 'nullable|string',
        ]);

        try {
            // SafeRemoteFetch evita SSRF (IPs internas, redirecciones) y corta por tamaño.
            $result = $this->uploads->store(
                SafeRemoteFetch::get($data['url'], ImageUploadService::MAX_BYTES),
                $data['folder'] ?? null,
                $data['publicId'] ?? null,
            );
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        } catch (\Throwable $e) {
            return $this->error('Error al subir la imagen desde URL', 400);
        }

        return $this->created($result, 'Imagen subida exitosamente desde URL');
    }

    /** POST /api/uploads/base64 */
    public function uploadBase64(Request $request)
    {
        $data = $request->validate([
            'image' => 'required|string',
            'folder' => 'nullable|string',
            'publicId' => 'nullable|string',
        ]);

        try {
            $result = $this->uploads->store(
                $this->uploads->decodeBase64($data['image']),
                $data['folder'] ?? null,
                $data['publicId'] ?? null,
            );
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return $this->created($result, 'Imagen subida exitosamente');
    }

    /** GET /api/uploads/optimize */
    public function getOptimizedUrl(Request $request)
    {
        $publicId = $request->query('publicId');
        if (! $publicId || ! is_string($publicId)) {
            return $this->error('Public ID requerido', 400);
        }

        // El almacenamiento local no transforma; se devuelve la URL directa.
        return $this->success(['url' => '/'.ltrim($publicId, '/')]);
    }

    /** DELETE /api/uploads/{publicId} */
    public function deleteImage(string $publicId)
    {
        $this->uploads->delete($publicId);

        return $this->success(null, 'Imagen eliminada exitosamente');
    }
}
