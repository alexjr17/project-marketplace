<?php

namespace App\Services\Marketing;

use App\Exceptions\BusinessRuleException;
use App\Models\Product;
use App\Services\Customizer\HuggingFaceClient;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Imágenes con IA para el estudio (FLUX.1-schnell en un Space de Hugging Face, con la cuota diaria
 * de GPU de las cuentas configuradas):
 * - diseno: un diseño para estampar, centrado y sobre fondo blanco liso (el editor puede quitarlo);
 * - fondo: un fondo o ambiente para posts y videos;
 * - foto: una foto de producto o de estilo de vida;
 * - prenda: la foto de una prenda lisa (para las vistas de una plantilla personalizable).
 *
 * La idea del usuario (en español) la convierte la IA de textos en una instrucción en inglés para
 * FLUX; sin esa IA, se usa la idea con la guía del tipo.
 *
 * Prenda en varias vistas (un solo producto que se ve igual desde todos los lados): se crea la foto
 * maestra del frente y las demás vistas salen de girar ESA foto con FLUX Kontext, que conserva la
 * tela, las costuras, las proporciones y el maniquí. Cada vista se puede recortar a PNG transparente
 * con RMBG-2.0.
 */
class MarketingImageService
{
    public const KINDS = ['diseno', 'fondo', 'foto', 'prenda'];

    public const RATIOS = ['1:1' => [1024, 1024], '4:5' => [896, 1120], '9:16' => [768, 1344], '16:9' => [1344, 768]];

    private const SPACE = 'black-forest-labs/FLUX.1-schnell';

    private const KONTEXT = 'black-forest-labs/FLUX.1-Kontext-Dev';

    private const RMBG = 'briaai/BRIA-RMBG-2.0';

    /** Respaldo del recorte: corre en CPU (no gasta la cuota diaria de GPU). */
    private const RMBG_CPU = 'briaai/BRIA-RMBG-1.4';

    /** Vistas que se giran con IA. La manga derecha es el espejo de la izquierda (la prenda es simétrica). */
    public const VIEWS = ['back', 'left'];

    /** Cómo se pide cada vista a Kontext (girando la misma prenda). */
    private const TURN = [
        'back' => 'Rotate this exact same garment 180 degrees to show its back view, straight-on and centered.',
        'left' => 'Rotate this exact same garment 90 degrees to show a pure side profile view, the garment facing the left edge of the image, so its left sleeve and armhole face the camera.',
    ];

    /** Segundos de GPU que pide una imagen (para elegir la cuenta con cuota). */
    private const GPU_SECONDS = 12;

    private const GUIDE = [
        'diseno' => 'a standalone graphic design for printing on a t-shirt, centered, bold clean shapes, high contrast, isolated on a plain pure white background, no t-shirt, no mockup, no frame',
        'fondo' => 'an aesthetic background for a fashion social media post, soft studio lighting, empty space in the center for a product, no text, no people',
        'foto' => 'professional fashion product photography, natural light, high detail, editorial look, no text',
        'prenda' => 'professional e-commerce product photo of a plain blank garment with no print and no logo, ghost mannequin, perfectly centered, even soft studio lighting, high detail fabric texture',
    ];

    public function __construct(private HuggingFaceClient $hf) {}

    /**
     * @return array{url:string, path:string, prompt:string}
     */
    public function generate(string $idea, string $kind, string $ratio = '1:1', ?string $rawPrompt = null): array
    {
        if (! in_array($kind, self::KINDS, true)) {
            throw new BusinessRuleException('Tipo de imagen no válido', 422);
        }
        @set_time_limit(600);
        [$w, $h] = self::RATIOS[$ratio] ?? self::RATIOS['1:1'];
        $prompt = $rawPrompt ?? $this->prompt(trim($idea), $kind);
        if (! $this->hf->accounts()) {
            throw new BusinessRuleException('Crear imágenes con IA necesita una cuenta de Hugging Face (HF_TOKEN en el .env de la API)', 422);
        }

        try {
            [[$file, $token]] = $this->hf->withAccount(self::GPU_SECONDS, function (string $token) use ($prompt, $w, $h) {
                $out = $this->hf->run(self::SPACE, '/infer', [$prompt, 0, true, $w, $h, 4], $token, 300);
                if (! is_array($out[0] ?? null) || empty($out[0]['url'])) {
                    throw new \RuntimeException('El servicio no devolvió la imagen');
                }

                return [$out[0], $token];
            });
        } catch (BusinessRuleException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::warning('[Marketing] Imagen IA: '.$e->getMessage());
            throw new BusinessRuleException('No se pudo crear la imagen ahora: '.mb_substr($e->getMessage(), 0, 180), 502);
        }

        $dir = public_path('uploads/marketing/ia');
        if (! is_dir($dir) && ! mkdir($dir, 0775, true) && ! is_dir($dir)) {
            throw new \RuntimeException('No se pudo crear la carpeta uploads/marketing/ia');
        }
        $ext = strtolower(pathinfo(parse_url((string) $file['url'], PHP_URL_PATH) ?: '', PATHINFO_EXTENSION)) ?: 'webp';
        $ext = in_array($ext, ['png', 'jpg', 'jpeg', 'webp'], true) ? $ext : 'webp';
        $name = $kind.'-'.Str::slug(Str::limit($idea, 40, '')).'-'.Str::lower(Str::random(6)).'.'.$ext;
        $this->hf->download($file, $dir.'/'.$name, $token);
        $path = 'uploads/marketing/ia/'.$name;

        return ['url' => '/'.$path, 'path' => $path, 'prompt' => $prompt];
    }

    /**
     * Foto maestra (frente) de una prenda lisa: con maniquí o con efecto fantasma (sin cuerpo).
     *
     * @return array{url:string, path:string, prompt:string}
     */
    public function garmentFront(string $idea, bool $mannequin, string $background = 'oscuro'): array
    {
        $bg = $background === 'claro' ? 'seamless light gray studio background' : 'seamless dark charcoal studio background';
        $how = $mannequin
            ? 'worn by a matte white headless dress form mannequin with a short neck, straight-on front view, centered, whole garment visible'
            : 'invisible ghost mannequin effect showing the hollow neck opening, no body, no mannequin, no hanger, straight-on front view, centered, whole garment visible';

        return $this->generate("{$idea}. {$how}, sleeves open and slightly extended away from the body, smooth natural fabric with very few wrinkles, {$bg}, soft even studio lighting, blank with no print and no logo", 'prenda', '1:1');
    }

    /**
     * Otra vista de la MISMA prenda: gira la foto maestra con Kontext y conserva todo lo demás.
     *
     * @return array{url:string, path:string}
     */
    public function garmentView(string $masterPath, string $view, bool $mannequin): array
    {
        if (! in_array($view, self::VIEWS, true)) {
            throw new BusinessRuleException('Vista no válida', 422);
        }
        $src = $this->ownFile($masterPath);
        $keep = 'Keep the identical garment: same fabric and color, same fit and proportions, same seams, same collar, same sleeve length and width, same hem, sleeves open and slightly extended away from the body, smooth fabric with very few wrinkles, '
            .($mannequin ? 'same mannequin, ' : 'same invisible ghost mannequin with no body, ')
            .'same studio lighting, same background, same camera distance, height and framing. Do not add any print, logo or text.';

        return $this->editFile(self::KONTEXT, '/infer', [['__file' => $src], self::TURN[$view].' '.$keep, 0, true, 2.5, 28], 60, 'vista-'.$view);
    }

    /** Estilos de escenografía para los fondos profesionales. */
    public const BACKDROP_STYLES = [
        'lujo' => 'luxury fashion studio set, rich materials, soft dramatic lighting, elegant and premium',
        'marmol' => 'classical marble and stone surfaces with warm golden light, museum-like elegance',
        'urbano' => 'urban streetwear set, concrete, metal and soft city light, editorial street style',
        'naturaleza' => 'natural set with organic textures, plants, sand or stone, soft daylight',
        'clasico' => 'classical architecture set with columns, arches and draped fabric, cinematic light',
        'minimal' => 'minimal studio set with clean geometric plinths, soft shadows, calm color blocking',
        'neon' => 'moody night set with neon accent light and soft haze, modern and bold',
    ];

    /**
     * Fondo profesional para presentar la prenda: una escenografía de estudio que combina con los
     * diseños que lleva (su tema, sus tonos), con espacio libre al centro para el producto.
     * La IA que ve imágenes mira los diseños y propone la escena; FLUX la genera.
     *
     * @param  array<int,string>  $designs  diseños como data URL (JPEG/PNG/WEBP, pequeños)
     * @param  array<int,string>  $palette  colores en hex sacados de los diseños
     * @return array{url:string, path:string, prompt:string, concept:string}
     */
    public function backdrop(string $style, string $idea, array $palette, array $designs, string $ratio = '1:1'): array
    {
        $styleText = self::BACKDROP_STYLES[$style] ?? self::BACKDROP_STYLES['lujo'];
        $colors = implode(', ', array_slice($palette, 0, 6));
        $plan = $this->backdropPlan($styleText, $idea, $colors, array_slice($designs, 0, 3));
        $prompt = $plan['prompt'].' Empty space in the center for a garment, no people, no clothing, no text, no letters, no logos, photorealistic, shallow depth of field, high-end advertising photography.';

        return $this->generate($idea !== '' ? $idea : 'fondo profesional', 'fondo', $ratio, $prompt) + ['concept' => $plan['concept']];
    }

    /** La escena: la propone la IA que ve los diseños; sin ella, sale del estilo, la idea y los colores. */
    private function backdropPlan(string $styleText, string $idea, string $colors, array $designs): array
    {
        $fallback = [
            'prompt' => "Professional product photography backdrop: {$styleText}".($idea !== '' ? ", inspired by: {$idea}" : '').($colors !== '' ? ", color palette {$colors}" : '').'.',
            'concept' => 'Escenografía '.($idea !== '' ? "inspirada en «{$idea}» " : '').'con los tonos de tus diseños.',
        ];
        $key = (string) config('services.groq.key');
        if ($key === '') {
            return $fallback;
        }
        $content = [['type' => 'text', 'text' => "You are an art director for a premium clothing brand. Look at these t-shirt print designs and design a photo set (background scenography) to present the t-shirt in an ad. Base it on the designs' theme and era, and use their color tones ({$colors}). Style direction: {$styleText}.".($idea !== '' ? " Client idea (Spanish): {$idea}." : '')
            .' The center must stay empty for the product. Reply ONLY JSON: {"prompt": "one detailed English prompt for an image model, max 80 words, describing only the empty set, materials, props at the sides, lighting and colors", "concept": "one short sentence in Spanish describing the set for the client"}']];
        foreach ($designs as $d) {
            $content[] = ['type' => 'image_url', 'image_url' => ['url' => $d]];
        }
        try {
            $r = Http::withToken($key)->timeout(60)->post('https://api.groq.com/openai/v1/chat/completions', [
                'model' => (string) config('services.groq.vision_model'),
                'temperature' => 0.6,
                'messages' => [['role' => 'user', 'content' => $content]],
            ]);
            $text = (string) $r->json('choices.0.message.content');
            $text = trim(preg_replace('/<think>.*?<\/think>/s', '', $text));
            if (preg_match('/\{.*\}/s', $text, $m)) {
                $j = json_decode($m[0], true);
                if (is_array($j) && ! empty($j['prompt'])) {
                    return ['prompt' => mb_substr(trim((string) $j['prompt']), 0, 900), 'concept' => mb_substr(trim((string) ($j['concept'] ?? $fallback['concept'])), 0, 300)];
                }
            }
            Log::warning('[Marketing] Fondo IA: la visión no devolvió JSON ('.$r->status().')');
        } catch (Throwable $e) {
            Log::warning('[Marketing] Fondo IA: '.$e->getMessage());
        }

        return $fallback;
    }

    /**
     * Ajuste de una foto de prenda con instrucciones (Kontext): quitar logos o etiquetas, menos arrugas,
     * cambiar el corte… conservando todo lo demás.
     *
     * @return array{url:string, path:string}
     */
    public function garmentEdit(string $path, string $instruction): array
    {
        $src = $this->ownFile($path);
        $instruction = trim(mb_substr($instruction, 0, 600));
        if ($instruction === '') {
            throw new BusinessRuleException('Escribe qué cambiar', 422);
        }

        return $this->editFile(self::KONTEXT, '/infer', [['__file' => $src], $instruction, 0, true, 2.5, 28], 60, 'ajuste');
    }

    /**
     * La misma imagen con el fondo transparente (PNG).
     *
     * @return array{url:string, path:string}
     */
    public function cutout(string $path): array
    {
        $src = $this->ownFile($path);
        $prefix = 'png-'.pathinfo($src, PATHINFO_FILENAME);
        try {
            return $this->editFile(self::RMBG, '/image', [['__file' => $src]], 10, $prefix, 1, 'png');
        } catch (BusinessRuleException $e) {
            // Sin cuota de GPU hoy: el recorte sale del modelo en CPU.
            if (! str_contains($e->getMessage(), 'cuota')) {
                throw $e;
            }

            return $this->editFile(self::RMBG_CPU, '/run', [['__file' => $src]], 0, $prefix, 1, 'png', cpu: true);
        }
    }

    /**
     * La foto de un producto sin su fondo (PNG transparente), para que en los posts y videos el
     * producto salga recortado y grande, sin el recuadro de su foto. Queda guardada: la misma foto no
     * se vuelve a recortar. Solo fotos de la tienda: archivos de /uploads o fotos de productos.
     *
     * @return array{url:string, cached:bool}
     */
    public function productCutout(string $url): array
    {
        $url = trim($url);
        $name = sha1($url).'.png';
        $rel = 'uploads/marketing/recortes/'.$name;
        if (is_file(public_path($rel))) {
            return ['url' => '/'.$rel, 'cached' => true];
        }
        $tmp = null;
        $src = $this->storeImage($url);
        if ($src === null) {
            if (! preg_match('#^https?://#i', $url) || ! $this->isProductPhoto($url)) {
                throw new BusinessRuleException('Imagen no encontrada', 404);
            }
            $r = Http::timeout(30)->get($url);
            $type = (string) $r->header('Content-Type');
            if (! $r->ok() || ! str_starts_with($type, 'image/') || strlen($r->body()) > 15_000_000) {
                throw new BusinessRuleException('No se pudo leer la foto del producto', 422);
            }
            @mkdir(storage_path('app/tmp'), 0775, true);
            $tmp = storage_path('app/tmp/recorte-'.Str::random(10).'.'.(str_contains($type, 'png') ? 'png' : (str_contains($type, 'webp') ? 'webp' : 'jpg')));
            file_put_contents($tmp, $r->body());
            $src = $tmp;
        }
        try {
            try {
                $out = $this->editFile(self::RMBG, '/image', [['__file' => $src]], 10, 'recorte', 1, 'png');
            } catch (BusinessRuleException $e) {
                if (! str_contains($e->getMessage(), 'cuota')) {
                    throw $e;
                }
                $out = $this->editFile(self::RMBG_CPU, '/run', [['__file' => $src]], 0, 'recorte', 1, 'png', cpu: true);
            }
        } finally {
            if ($tmp) {
                @unlink($tmp);
            }
        }
        @mkdir(public_path('uploads/marketing/recortes'), 0775, true);
        rename(public_path($out['path']), public_path($rel));

        return ['url' => '/'.$rel, 'cached' => false];
    }

    /** Archivo de imagen dentro de public/uploads (o null si la URL no es de ahí). */
    private function storeImage(string $url): ?string
    {
        $path = parse_url($url, PHP_URL_PATH) ?: '';
        $host = parse_url($url, PHP_URL_HOST);
        if ($host && ! in_array($host, [parse_url((string) config('app.url'), PHP_URL_HOST), 'localhost', '127.0.0.1'], true)) {
            return null;
        }
        $path = ltrim(rawurldecode($path), '/');
        if (! preg_match('#^uploads/[\w./-]+\.(png|jpe?g|webp)$#i', $path) || str_contains($path, '..')) {
            return null;
        }
        $full = realpath(public_path($path));
        $base = realpath(public_path('uploads'));

        return $full && $base && str_starts_with($full, $base) && is_file($full) ? $full : null;
    }

    /** ¿La URL externa es la foto de algún producto? (nunca se descarga cualquier dirección). */
    private function isProductPhoto(string $url): bool
    {
        foreach (Product::query()->pluck('images') as $imgs) {
            $list = is_array($imgs) ? $imgs : (json_decode((string) $imgs, true) ?: []);
            array_walk_recursive($list, function ($v) use ($url, &$found) {
                $found = $found || $v === $url;
            });
            if (! empty($found)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Espejo horizontal de un PNG (la manga derecha a partir de la izquierda: idéntica, al revés).
     *
     * @return array{url:string, path:string}
     */
    public function mirror(string $path): array
    {
        $src = $this->ownFile($path);
        $img = strtolower(pathinfo($src, PATHINFO_EXTENSION)) === 'png' ? @imagecreatefrompng($src) : false;
        if (! $img) {
            throw new BusinessRuleException('El espejo se hace sobre la vista en PNG (con el fondo quitado)', 422);
        }
        imagealphablending($img, false);
        imagesavealpha($img, true);
        imageflip($img, IMG_FLIP_HORIZONTAL);
        $name = 'espejo-'.Str::limit(pathinfo($src, PATHINFO_FILENAME), 40, '').'-'.Str::lower(Str::random(6)).'.png';
        imagepng($img, public_path('uploads/marketing/ia/'.$name));
        imagedestroy($img);

        return ['url' => '/uploads/marketing/ia/'.$name, 'path' => 'uploads/marketing/ia/'.$name];
    }

    /** Solo imágenes creadas por la IA del estudio (nunca cualquier archivo del servidor). */
    private function ownFile(string $path): string
    {
        $path = ltrim($path, '/');
        $full = realpath(public_path($path));
        $base = realpath(public_path('uploads/marketing/ia'));
        if (! preg_match('#^uploads/marketing/ia/[\w.-]+$#', $path) || ! $full || ! $base || ! str_starts_with($full, $base) || ! is_file($full)) {
            throw new BusinessRuleException('Imagen no encontrada', 404);
        }

        return $full;
    }

    /**
     * Corre un Space de edición de imagen y guarda su resultado en uploads/marketing/ia.
     *
     * @return array{url:string, path:string}
     */
    private function editFile(string $space, string $api, array $data, int $gpuSeconds, string $prefix, int $outIndex = 0, ?string $ext = null, bool $cpu = false): array
    {
        @set_time_limit(600);
        if (! $this->hf->accounts()) {
            throw new BusinessRuleException('Crear imágenes con IA necesita una cuenta de Hugging Face (HF_TOKEN en el .env de la API)', 422);
        }
        // En CPU no hay cuota que revisar: se usa la primera cuenta.
        $runner = $cpu
            ? fn (callable $fn) => [$fn((string) array_values($this->hf->accounts())[0]), 1]
            : fn (callable $fn) => $this->hf->withAccount($gpuSeconds, $fn);
        try {
            [[$file, $token]] = $runner(function (string $token) use ($space, $api, $data, $outIndex) {
                $out = $this->hf->run($space, $api, $data, $token, 600);
                $f = $out[$outIndex] ?? null;
                if (! is_array($f) || empty($f['url'])) {
                    throw new \RuntimeException('El servicio no devolvió la imagen');
                }

                return [$f, $token];
            });
        } catch (BusinessRuleException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::warning('[Marketing] Edición de imagen ('.$space.'): '.$e->getMessage());
            throw new BusinessRuleException('No se pudo crear la imagen ahora: '.mb_substr($e->getMessage(), 0, 180), 502);
        }
        $ext ??= strtolower(pathinfo(parse_url((string) $file['url'], PHP_URL_PATH) ?: '', PATHINFO_EXTENSION)) ?: 'webp';
        $ext = in_array($ext, ['png', 'jpg', 'jpeg', 'webp'], true) ? $ext : 'webp';
        $name = Str::limit(Str::slug($prefix), 50, '').'-'.Str::lower(Str::random(6)).'.'.$ext;
        $this->hf->download($file, public_path('uploads/marketing/ia/'.$name), $token);

        return ['url' => '/uploads/marketing/ia/'.$name, 'path' => 'uploads/marketing/ia/'.$name];
    }

    /** Instrucción en inglés para FLUX: la escribe la IA de textos; si no hay, la idea más la guía del tipo. */
    private function prompt(string $idea, string $kind): string
    {
        $guide = self::GUIDE[$kind];
        $key = (string) config('services.groq.key');
        if ($key !== '') {
            try {
                $r = Http::withToken($key)->timeout(30)->post('https://api.groq.com/openai/v1/chat/completions', [
                    'model' => (string) config('services.groq.copy_model'),
                    'temperature' => 0.5,
                    'response_format' => ['type' => 'json_object'],
                    'messages' => [
                        ['role' => 'system', 'content' => 'You write prompts for the FLUX image model. Reply ONLY with JSON {"prompt": "..."}.'],
                        ['role' => 'user', 'content' => "Write one detailed English prompt (max 70 words) for this idea, written in Spanish by a clothing brand: \"{$idea}\". Requirements: {$guide}. Describe subject, style, colors and composition. Never add written words or letters unless the idea explicitly asks for them."],
                    ],
                ]);
                $p = trim((string) (json_decode((string) $r->json('choices.0.message.content'), true)['prompt'] ?? ''));
                if ($r->successful() && $p !== '') {
                    return mb_substr($p, 0, 900);
                }
            } catch (Throwable $e) {
                Log::warning('[Marketing] Prompt de imagen: '.$e->getMessage());
            }
        }

        return mb_substr($idea.'. '.$guide, 0, 900);
    }
}
