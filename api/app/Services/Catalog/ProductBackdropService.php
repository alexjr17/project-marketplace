<?php

namespace App\Services\Catalog;

use App\Exceptions\BusinessRuleException;
use App\Models\Product;
use App\Services\Marketing\MarketingImageService;
use App\Support\ImageUrls;
use App\Support\TemplateImages;

/**
 * Fondo de la foto de un producto en la tienda (productos normales y plantillas personalizables):
 * una imagen de fondo (subida o generada con IA) y la foto principal del producto recortada (sin su
 * fondo) para ponerla encima. Si la foto principal cambia, el recorte deja de usarse hasta volver a
 * guardar el fondo.
 *
 * backdrop = { url, cutout|null, source } (source = huella de la foto con la que se hizo el recorte).
 */
class ProductBackdropService
{
    public function __construct(private MarketingImageService $images) {}

    /** Foto principal del producto tal como se guarda (URL o data URI). */
    public function mainImage(Product $p): ?string
    {
        if ($p->isTemplate) {
            return TemplateImages::withZones($p->images, $p->zoneTypeImages)['front'] ?: null;
        }

        return ImageUrls::slotValue($p->images, 'front');
    }

    /** Lo que ve la tienda: el fondo y el recorte (solo si sigue siendo de la foto actual). */
    public function format(Product $p): ?array
    {
        $b = is_array($p->backdrop) ? $p->backdrop : null;
        if (! $b || empty($b['url'])) {
            return null;
        }
        $main = $this->mainImage($p);
        $fresh = $main && ($b['source'] ?? null) === sha1($main);

        return ['url' => $b['url'], 'cutout' => $fresh ? ($b['cutout'] ?? null) : null];
    }

    /**
     * Pone (o quita, con null) el fondo y recorta la foto principal. Si el recorte falla (sin cuota de
     * IA…), el fondo queda igual y la tienda muestra la foto tal cual.
     *
     * @return array{backdrop: ?array, warning: ?string}
     */
    public function set(Product $p, ?string $url): array
    {
        if ($url === null || trim($url) === '') {
            $p->backdrop = null;
            $p->save();

            return ['backdrop' => null, 'warning' => null];
        }
        $url = $this->localPath($url) ?? throw new BusinessRuleException('El fondo debe ser una imagen subida a la tienda', 422);
        $main = $this->mainImage($p);
        $cutout = null;
        $warning = null;
        if (! $main) {
            $warning = 'El producto no tiene foto principal: se verá solo el fondo hasta que la tenga.';
        } else {
            try {
                $cutout = $this->transparent($main) ?? $this->images->productCutout($this->servable($main))['url'];
            } catch (BusinessRuleException $e) {
                $warning = 'No se pudo recortar la foto ('.$e->getMessage().'). Se verá la foto tal cual sobre el fondo; vuelve a intentarlo más tarde.';
            }
        }
        $p->backdrop = ['url' => $url, 'cutout' => $cutout, 'source' => $main ? sha1($main) : null];
        $p->save();

        return ['backdrop' => $this->format($p), 'warning' => $warning];
    }

    /** "/uploads/…" (acepta la URL completa de este mismo servidor). */
    private function localPath(string $url): ?string
    {
        $path = parse_url(trim($url), PHP_URL_PATH) ?: '';
        $host = parse_url(trim($url), PHP_URL_HOST);
        if ($host && ! in_array($host, [parse_url((string) config('app.url'), PHP_URL_HOST), 'localhost', '127.0.0.1'], true)) {
            return null;
        }

        return preg_match('#^/uploads/[\w./-]+\.(png|jpe?g|webp)$#i', $path) && ! str_contains($path, '..') ? $path : null;
    }

    /** La foto como algo que el recorte puede leer: las embebidas (data URI) se guardan como archivo. */
    private function servable(string $image): string
    {
        if (! str_starts_with($image, 'data:image/')) {
            return $this->localPath($image) ?? $image;
        }
        if (! preg_match('#^data:image/(png|jpe?g|webp);base64,(.+)$#s', $image, $m)) {
            throw new BusinessRuleException('Formato de foto no soportado', 422);
        }
        $ext = $m[1] === 'jpeg' ? 'jpg' : $m[1];
        $rel = 'uploads/products/fotos/'.sha1($image).'.'.$ext;
        if (! is_file(public_path($rel))) {
            @mkdir(public_path('uploads/products/fotos'), 0775, true);
            file_put_contents(public_path($rel), base64_decode($m[2]));
        }

        return '/'.$rel;
    }

    /** Si la foto ya es un PNG sin fondo (esquinas transparentes), se usa tal cual. */
    private function transparent(string $image): ?string
    {
        $path = $this->servable($image);
        $file = str_starts_with($path, '/uploads/') ? public_path(ltrim($path, '/')) : null;
        if (! $file || ! is_file($file) || ! str_ends_with(strtolower($file), '.png')) {
            return null;
        }
        $im = @imagecreatefrompng($file);
        if (! $im) {
            return null;
        }
        $w = imagesx($im) - 1;
        $h = imagesy($im) - 1;
        $clear = 0;
        foreach ([[0, 0], [$w, 0], [0, $h], [$w, $h]] as [$x, $y]) {
            if (((imagecolorat($im, $x, $y) >> 24) & 0x7F) > 100) {
                $clear++;
            }
        }
        imagedestroy($im);

        return $clear >= 3 ? $path : null;
    }
}
