<?php

namespace App\Services\Settings;

use App\Exceptions\BusinessRuleException;
use Illuminate\Support\Str;

/**
 * Guarda imágenes en public/uploads/<carpeta> (sin servicios externos, sirve en hosting
 * compartido). Devuelve {url, publicId, width, height, format, bytes}, el contrato que
 * usaba Cloudinary en el backend Node.
 */
class ImageUploadService
{
    /** Subcarpetas válidas; cualquier otro valor cae en "general". */
    public const FOLDERS = ['products', 'designs', 'avatars', 'orders', 'templates', 'references', 'models3d', 'marketing', 'general'];

    public const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

    public function folder(?string $name): string
    {
        return in_array($name, self::FOLDERS, true) ? $name : 'general';
    }

    /**
     * Valida que los bytes sean una imagen soportada y la guarda.
     *
     * @throws BusinessRuleException (400) si no es una imagen válida o supera el tamaño
     */
    public function store(string $bytes, ?string $folder, ?string $publicId): array
    {
        $info = @getimagesizefromstring($bytes);
        if ($info === false) {
            throw new BusinessRuleException('El archivo no es una imagen válida', 400);
        }
        if (strlen($bytes) > self::MAX_BYTES) {
            throw new BusinessRuleException('La imagen supera el tamaño máximo de 10 MB', 400);
        }

        $ext = match ($info[2]) {
            IMAGETYPE_JPEG => 'jpg',
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_GIF => 'gif',
            IMAGETYPE_WEBP => 'webp',
            default => throw new BusinessRuleException('Formato de imagen no soportado', 400),
        };

        $folder = $this->folder($folder);
        $name = ($publicId ? Str::slug($publicId) : Str::random(20)).'-'.time().'.'.$ext;
        $path = "uploads/{$folder}/{$name}";
        file_put_contents($this->dir($folder).'/'.$name, $bytes);

        return [
            // URL relativa: funciona en el mismo origen del frontend (proxy en desarrollo,
            // mismo dominio en producción).
            'url' => '/'.$path,
            'publicId' => $path,
            'width' => $info[0],
            'height' => $info[1],
            'format' => $ext,
            'bytes' => strlen($bytes),
        ];
    }

    /** Bytes de una imagen en base64 (con o sin el prefijo data:...;base64,). */
    public function decodeBase64(string $raw): string
    {
        if (str_starts_with($raw, 'data:')) {
            $raw = (string) preg_replace('/^data:[^;]+;base64,/', '', $raw);
        }
        $bytes = base64_decode($raw, true);
        if ($bytes === false) {
            throw new BusinessRuleException('La imagen base64 no es válida', 400);
        }

        return $bytes;
    }

    /** Borra una imagen dentro de uploads/ (sin escapar el directorio). */
    public function delete(string $publicId): void
    {
        $clean = ltrim(str_replace('..', '', $publicId), '/');
        if (! str_starts_with($clean, 'uploads/')) {
            throw new BusinessRuleException('Public ID inválido', 400);
        }
        $path = public_path($clean);
        if (! is_file($path)) {
            throw new BusinessRuleException('Imagen no encontrada o ya fue eliminada', 404);
        }
        unlink($path);
    }

    /** Directorio absoluto de la carpeta, creándolo si falta. */
    private function dir(string $folder): string
    {
        $dir = public_path("uploads/{$folder}");
        // Varias subidas a la vez pueden crear la carpeta al mismo tiempo: solo falla si al final no existe.
        if (! is_dir($dir) && ! @mkdir($dir, 0775, true) && ! is_dir($dir)) {
            throw new \RuntimeException("No se pudo crear la carpeta de subidas: {$folder}");
        }

        return $dir;
    }
}
