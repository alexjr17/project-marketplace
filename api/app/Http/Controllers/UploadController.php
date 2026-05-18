<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Subida de imágenes a almacenamiento local (carpeta public/uploads).
 *
 * En el backend Node se usaba Cloudinary; aquí se guarda en disco para que
 * funcione en hosting compartido cPanel sin servicios externos. El contrato
 * de respuesta {url, publicId, width, height, format, bytes} se mantiene.
 */
class UploadController extends Controller
{
    use ApiResponse;

    /** Subcarpetas válidas; cualquier otro valor cae en "general". */
    private const FOLDERS = ['products', 'designs', 'avatars', 'orders', 'templates', 'general'];

    private const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

    private function folder(?string $name): string
    {
        return in_array($name, self::FOLDERS, true) ? $name : 'general';
    }

    /** Directorio absoluto de subidas para una carpeta, creándolo si falta. */
    private function uploadDir(string $folder): string
    {
        $dir = public_path("uploads/{$folder}");
        if (! is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        return $dir;
    }

    /** Guarda los bytes de una imagen y devuelve el resultado con metadatos. */
    private function storeImageBytes(string $bytes, string $folder, ?string $publicId): array
    {
        $info = @getimagesizefromstring($bytes);
        if ($info === false) {
            throw new \RuntimeException('El archivo no es una imagen válida');
        }
        if (strlen($bytes) > self::MAX_BYTES) {
            throw new \RuntimeException('La imagen supera el tamaño máximo de 10 MB');
        }

        $ext = match ($info[2]) {
            IMAGETYPE_JPEG => 'jpg',
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_GIF => 'gif',
            IMAGETYPE_WEBP => 'webp',
            default => throw new \RuntimeException('Formato de imagen no soportado'),
        };

        $name = ($publicId ? Str::slug($publicId) : Str::random(20)).'-'.time().'.'.$ext;
        $path = "uploads/{$folder}/{$name}";
        file_put_contents($this->uploadDir($folder).'/'.$name, $bytes);

        return [
            // URL relativa: funciona en el mismo origen del frontend (vía
            // proxy en desarrollo, mismo dominio en producción).
            'url' => '/'.$path,
            'publicId' => $path,
            'width' => $info[0],
            'height' => $info[1],
            'format' => $ext,
            'bytes' => strlen($bytes),
        ];
    }

    /** POST /api/uploads/image */
    public function uploadImage(Request $request)
    {
        if (! $request->hasFile('image')) {
            return $this->error('No se proporcionó ninguna imagen', 400);
        }

        try {
            $result = $this->storeImageBytes(
                file_get_contents($request->file('image')->getRealPath()),
                $this->folder($request->input('folder')),
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

        $folder = $this->folder($request->input('folder'));
        $results = [];
        try {
            foreach ((array) $files as $file) {
                $results[] = $this->storeImageBytes(file_get_contents($file->getRealPath()), $folder, null);
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
            $response = Http::timeout(20)->get($data['url']);
            if (! $response->successful()) {
                return $this->error('No se pudo descargar la imagen desde la URL', 400);
            }
            $result = $this->storeImageBytes(
                $response->body(),
                $this->folder($data['folder'] ?? null),
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

        $raw = $data['image'];
        if (str_starts_with($raw, 'data:')) {
            $raw = (string) preg_replace('/^data:[^;]+;base64,/', '', $raw);
        }
        $bytes = base64_decode($raw, true);
        if ($bytes === false) {
            return $this->error('La imagen base64 no es válida', 400);
        }

        try {
            $result = $this->storeImageBytes(
                $bytes,
                $this->folder($data['folder'] ?? null),
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
        // Solo se permite borrar dentro de uploads/, sin escapar el directorio.
        $clean = ltrim(str_replace('..', '', $publicId), '/');
        if (! str_starts_with($clean, 'uploads/')) {
            return $this->error('Public ID inválido', 400);
        }

        $path = public_path($clean);
        if (! is_file($path)) {
            return $this->error('Imagen no encontrada o ya fue eliminada', 404);
        }

        unlink($path);

        return $this->success(null, 'Imagen eliminada exitosamente');
    }
}
