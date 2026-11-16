<?php

namespace App\Services\Marketing;

use App\Models\Setting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Textos del estudio de contenido con IA (Groq): título corto para la pieza, subtítulo, llamado a la
 * acción, el texto del post y hashtags, en el tono de la marca. Si Groq no está configurado o falla,
 * arma el texto con plantillas para no dejar al usuario sin nada.
 *
 * En el video por escenas también escribe el título y el subtítulo de cada escena (`scenes`), para que
 * juntas cuenten una historia corta: gancho, beneficio, detalle y llamado a la acción.
 */
class MarketingCopyService
{
    public const TONES = ['cercano', 'urgente', 'elegante', 'divertido', 'inspirador'];

    public const SCENE_KINDS = ['3d', 'foto', 'texto', 'clip'];

    /**
     * @param  array{kind:string, source:string, tone?:string, brief?:string, items?:array, scenes?:array}  $ctx
     * @return array{title:string, subtitle:string, cta:string, caption:string, hashtags:array<int,string>, scenes?:array<int,array{title:string,subtitle:string}>, ai:bool}
     */
    public function write(array $ctx): array
    {
        $scenes = $this->scenePlan($ctx['scenes'] ?? []);
        $key = (string) config('services.groq.key');
        if ($key !== '') {
            try {
                return $this->withScenes($this->withGroq($key, $ctx, $scenes), $scenes, $ctx) + ['ai' => true];
            } catch (Throwable $e) {
                Log::warning('[Marketing] Groq: '.$e->getMessage());
            }
        }

        return $this->withScenes($this->fallback($ctx), $scenes, $ctx) + ['ai' => false];
    }

    /** Escenas del video que piden texto: tipo y de qué es cada una (máx. 12). */
    private function scenePlan(array $scenes): array
    {
        return array_values(array_map(fn ($s) => [
            'kind' => in_array($s['kind'] ?? '', self::SCENE_KINDS, true) ? $s['kind'] : '3d',
            'about' => mb_substr(trim((string) ($s['about'] ?? '')), 0, 120),
        ], array_slice($scenes, 0, 12)));
    }

    /**
     * Deja un texto por escena (uno por cada escena pedida): los de la IA si vinieron completos y,
     * si faltan, de plantillas.
     */
    private function withScenes(array $copy, array $plan, array $ctx): array
    {
        $given = $copy['scenes'] ?? [];
        unset($copy['scenes']);
        if (! $plan) {
            return $copy;
        }
        $copy['scenes'] = [];
        $n = count($plan);
        foreach ($plan as $i => $scene) {
            $g = (array) ($given[$i] ?? []);
            $title = mb_substr(trim((string) ($g['title'] ?? '')), 0, 40);
            $subtitle = mb_substr(trim((string) ($g['subtitle'] ?? '')), 0, 60);
            if ($title === '' && $subtitle === '') {
                [$title, $subtitle] = $this->sceneFallback($scene, $i, $n, $copy, $ctx);
            }
            $copy['scenes'][] = ['title' => $title, 'subtitle' => $subtitle];
        }

        return $copy;
    }

    /** Texto de plantilla para una escena: la primera engancha, la última invita a comprar. */
    private function sceneFallback(array $scene, int $i, int $n, array $copy, array $ctx): array
    {
        if ($i === 0) {
            return [$copy['title'], $copy['subtitle']];
        }
        if ($i === $n - 1) {
            return [in_array($ctx['source'], ['plantilla', 'diseno'], true) ? 'Diseña la tuya' : ($copy['cta'] ?: 'Compra ya'), 'Encuéntrala en '.$this->brand()['name']];
        }
        $about = $scene['about'];

        return match ($scene['kind']) {
            'foto', 'clip' => [$about, ''],
            'texto' => [$about !== '' ? $about : 'Hecha para ti', ''],
            default => [$i % 2 ? 'Tu diseño, tu estilo' : 'Calidad que se siente', $about],
        };
    }

    /** ¿Hay llave de Groq configurada? (sin ella los textos salen de plantillas). */
    public function configured(): bool
    {
        return (string) config('services.groq.key') !== '';
    }

    public function __construct(private MarketingBrandService $brandKit) {}

    /** Datos de la marca para redactar (ficha de la marca del estudio). */
    private function brand(): array
    {
        $k = $this->brandKit->get();

        return [
            'name' => (string) $k['name'],
            'about' => (string) $k['description'],
            'slogan' => (string) $k['slogan'],
            'personality' => (string) ($k['voice']['personality'] ?? ''),
            'avoid' => (string) ($k['voice']['avoid'] ?? ''),
            'tone' => (string) ($k['voice']['tone'] ?? 'cercano'),
            'hashtags' => (array) ($k['voice']['hashtags'] ?? []),
        ];
    }

    private function withGroq(string $key, array $ctx, array $scenes = []): array
    {
        $brand = $this->brand();
        $tone = in_array($ctx['tone'] ?? '', self::TONES, true) ? $ctx['tone'] : $brand['tone'];
        $format = [
            'post' => 'una publicación de feed (imagen cuadrada)',
            'historia' => 'una historia vertical de Instagram/Facebook',
            'reel' => 'un reel/video corto vertical de 6 a 15 segundos',
            'video360' => 'un video corto de la prenda personalizable girando en 3D',
        ][$ctx['kind']] ?? 'una publicación';
        $items = array_map(fn ($i) => $this->forAi((array) $i), array_slice((array) ($ctx['items'] ?? []), 0, 8));

        $system = "Eres el community manager de {$brand['name']}, una marca colombiana de ropa".
            ($brand['about'] ? " ({$brand['about']})" : '').
            ($brand['slogan'] ? ". Lema: \"{$brand['slogan']}\"" : '').
            ($brand['personality'] ? ". Personalidad de la marca: {$brand['personality']}" : '').
            ($brand['avoid'] ? ". Evita: {$brand['avoid']}" : '').
            '. Escribes en español de Colombia, natural y sin exagerar, con emojis con moderación. '.
            'Nunca inventas precios, descuentos, fechas ni datos que no te den. Responde SOLO un objeto JSON.';
        $user = "Escribe los textos para {$format}, en tono {$tone}.\n".
            'Qué se promociona ('.$ctx['source']."):\n".json_encode($items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)."\n".
            (! empty($ctx['brief']) ? "Indicaciones del usuario: {$ctx['brief']}\n" : '').
            "Devuelve JSON con estas claves:\n".
            "- title: título para poner SOBRE la imagen, máximo 5 palabras, impactante\n".
            "- subtitle: frase corta para la imagen, máximo 9 palabras\n".
            "- cta: llamado a la acción para un botón, máximo 3 palabras (ej. \"Compra ya\")\n".
            "- caption: el texto del post, 2 a 4 frases cortas, con el beneficio, precio u oferta si los hay y un llamado a la acción\n".
            '- hashtags: lista de 8 a 12 hashtags relevantes en español (sin #), mezcla de marca, producto y tendencia'.
            ($scenes ? "\n- scenes: lista de exactamente ".count($scenes).' objetos {title, subtitle}, uno por escena del video y en el mismo orden. '.
                'title máximo 4 palabras y subtitle máximo 7 (puede ir vacío). Juntas cuentan una historia: la primera engancha, '.
                'las del medio muestran beneficios o detalles y la última invita a comprar. Escenas: '.
                json_encode($scenes, JSON_UNESCAPED_UNICODE) : '');

        $r = Http::withToken($key)->timeout(40)->post('https://api.groq.com/openai/v1/chat/completions', [
            'model' => (string) config('services.groq.copy_model'),
            'temperature' => 0.8,
            'response_format' => ['type' => 'json_object'],
            'messages' => [['role' => 'system', 'content' => $system], ['role' => 'user', 'content' => $user]],
        ]);
        if (! $r->successful()) {
            throw new \RuntimeException('HTTP '.$r->status().' '.mb_substr($r->body(), 0, 200));
        }
        $data = json_decode((string) $r->json('choices.0.message.content'), true);
        if (! is_array($data) || empty($data['caption'])) {
            throw new \RuntimeException('Respuesta sin texto');
        }

        $copy = $this->withBrandTags($this->clean($data), $brand['hashtags']);
        if ($scenes && is_array($data['scenes'] ?? null)) {
            $copy['scenes'] = array_values($data['scenes']);
        }

        return $copy;
    }

    /** Los hashtags fijos de la marca van primero y sin repetirse. */
    private function withBrandTags(array $copy, array $brandTags): array
    {
        $copy['hashtags'] = array_slice(array_values(array_unique(array_merge($brandTags, $copy['hashtags']))), 0, 15);

        return $copy;
    }

    /** Solo el texto útil para redactar (sin fotos: pesan y la IA no las lee). */
    private function forAi(array $item): array
    {
        $keep = ['name', 'description', 'category', 'tags', 'price', 'listPrice', 'discountPercent', 'label', 'code', 'isAuto', 'minSubtotal', 'endsAt', 'count'];
        $out = array_intersect_key($item, array_flip($keep));
        if (isset($out['description'])) {
            $out['description'] = mb_substr(strip_tags((string) $out['description']), 0, 300);
        }
        if (! empty($item['products'])) {
            $out['products'] = array_map(fn ($p) => array_intersect_key((array) $p, array_flip(['name', 'price', 'listPrice', 'discountPercent'])), array_slice((array) $item['products'], 0, 6));
        }

        return $out;
    }

    private function clean(array $d): array
    {
        $tags = array_values(array_unique(array_filter(array_map(
            fn ($t) => preg_replace('/[^\p{L}\p{N}_]/u', '', ltrim((string) $t, '#')),
            (array) ($d['hashtags'] ?? [])
        ))));

        return [
            'title' => mb_substr(trim((string) ($d['title'] ?? '')), 0, 60),
            'subtitle' => mb_substr(trim((string) ($d['subtitle'] ?? '')), 0, 90),
            'cta' => mb_substr(trim((string) ($d['cta'] ?? 'Compra ya')), 0, 24),
            'caption' => mb_substr(trim((string) ($d['caption'] ?? '')), 0, 2000),
            'hashtags' => array_slice($tags, 0, 15),
        ];
    }

    /** Textos con plantillas (sin IA). */
    private function fallback(array $ctx): array
    {
        $brand = $this->brand()['name'];
        $first = (array) (($ctx['items'] ?? [])[0] ?? []);
        $name = (string) ($first['name'] ?? $brand);
        $price = isset($first['price']) ? '$'.number_format((float) $first['price'], 0, ',', '.') : null;
        $off = (int) ($first['discountPercent'] ?? 0);
        [$title, $subtitle, $caption] = match ($ctx['source']) {
            'promocion' => [
                ($first['label'] ?? 'Oferta').' en '.$brand,
                ! empty($first['code']) ? 'Usa el código '.$first['code'] : 'Por tiempo limitado',
                'Aprovecha '.mb_strtolower((string) ($first['name'] ?? 'nuestra promoción')).(! empty($first['code']) ? ' con el código '.$first['code'] : '').'. ¡Corre que se acaba!',
            ],
            'coleccion' => ['Colección '.$name, 'Prendas que te representan', 'Conoce la colección '.$name.' de '.$brand.'. Encuentra tu favorita en la tienda.'],
            'plantilla', 'diseno' => ['Diseña la tuya', 'Tu diseño, tu estilo', 'Crea una prenda única con tu propio diseño en '.$brand.'. Elige el modelo, sube tu imagen y míralo en 3D.'],
            default => [
                $off > 0 ? '-'.$off.'% '.$name : $name,
                $price ? 'Ahora a '.$price : 'Nuevo en '.$brand,
                $name.($price ? ' a '.$price : '').($off > 0 ? ' con '.$off.'% de descuento' : '').'. Disponible en '.$brand.'.',
            ],
        };

        return [
            'title' => mb_substr($title, 0, 60),
            'subtitle' => $subtitle,
            'cta' => 'Compra ya',
            'caption' => $caption,
            'hashtags' => array_values(array_unique(array_merge($this->brand()['hashtags'], array_filter([mb_strtolower(preg_replace('/\s+/', '', $brand)), 'moda', 'ropa', 'modacolombiana', 'outfit', 'estilo', 'tendencia', 'personalizado'])))),
        ];
    }
}
