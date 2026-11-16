<?php

namespace App\Services\Marketing;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Ayuda IA del editor de video: revisa el guion (escenas, transiciones, sonidos, textos) y recomienda
 * por escena la transición, su duración, el sonido que le va, la animación del texto, el movimiento
 * de cámara de las escenas 3D y la duración, además de consejos generales para redes.
 *
 * La respuesta siempre sale de los catálogos del editor: lo que la IA invente se corrige. Si Groq no
 * está configurado o falla, recomienda con reglas propias según el tono.
 */
class MarketingVideoAdviceService
{
    public const TRANSITIONS = ['corte', 'fundido', 'color', 'barrido', 'empujar', 'deslizar', 'zoom', 'remolino', 'circulo', 'persiana', 'diagonal', 'desenfoque', 'glitch', 'mosaico', 'destello', 'cortina'];

    public const SCENE_KINDS = ['3d', 'foto', 'texto', 'clip'];

    /** Sonidos que le van a cada transición (el primero es el recomendado). Igual que en el editor (sfx.ts). */
    public const TRANSITION_SOUNDS = [
        'corte' => ['click', 'impacto', 'obturador', 'chasquido', 'pop', 'subdrop'],
        'fundido' => ['swoosh', 'brillo', 'campana', 'reverso'],
        'color' => ['swoosh', 'bajo', 'campana', 'subdrop'],
        'desenfoque' => ['whoosh', 'swoosh', 'brillo', 'reverso'],
        'barrido' => ['swipe', 'whoosh', 'swoosh', 'zap'],
        'empujar' => ['whoosh', 'swipe', 'swoosh', 'chasquido'],
        'deslizar' => ['swoosh', 'burbuja', 'swipe', 'blip'],
        'diagonal' => ['swipe', 'whoosh', 'swoosh', 'zap'],
        'zoom' => ['whoosh', 'riser', 'impacto', 'reverso', 'subdrop'],
        'remolino' => ['whoosh', 'riser', 'cinta', 'zap'],
        'circulo' => ['pop', 'burbuja', 'brillo', 'blip'],
        'persiana' => ['obturador', 'click', 'swipe', 'chasquido'],
        'glitch' => ['glitch', 'click', 'cinta', 'blip', 'zap'],
        'mosaico' => ['glitch', 'pop', 'burbuja', 'blip'],
        'destello' => ['obturador', 'brillo', 'impacto', 'subdrop'],
        'cortina' => ['whoosh', 'bajo', 'impacto', 'reverso'],
    ];


    public const TEXT_ANIMS = ['subir', 'pop', 'deslizar', 'escribir', 'letras', 'ninguna'];

    public const MOTIONS = ['giro', 'giroRapido', 'revelar', 'orbita', 'heroe', 'frente', 'espalda', 'perfil', 'vaiven', 'acercar', 'detalle'];

    /** Transiciones por estilo (para las reglas sin IA). */
    private const ENERGETIC = ['zoom', 'empujar', 'glitch', 'remolino', 'barrido', 'destello'];

    private const SOFT = ['fundido', 'desenfoque', 'deslizar', 'color', 'circulo'];

    public function __construct(private MarketingBrandService $brandKit) {}

    /**
     * @param  array{tone?:string, brief?:string, ratio?:string, hasMusic?:bool, endCard?:bool, scenes:array}  $ctx
     * @return array{ai:bool, summary:string, tips:array<int,string>, scenes:array<int,array>}
     */
    public function advise(array $ctx): array
    {
        $scenes = array_values(array_slice($ctx['scenes'], 0, 12));
        $base = $this->rules($ctx, $scenes);
        $key = (string) config('services.groq.key');
        if ($key !== '') {
            try {
                return $this->merge($this->withGroq($key, $ctx, $scenes), $base, count($scenes)) + ['ai' => true];
            } catch (Throwable $e) {
                Log::warning('[Marketing] Ayuda IA de video: '.$e->getMessage());
            }
        }

        return $base + ['ai' => false];
    }

    private function withGroq(string $key, array $ctx, array $scenes): array
    {
        $brand = $this->brandKit->get();
        $tone = (string) ($ctx['tone'] ?? ($brand['voice']['tone'] ?? 'cercano'));
        $catalog = [
            'transiciones' => self::TRANSITIONS,
            'sonidosPorTransicion' => self::TRANSITION_SOUNDS,
            'animacionesDeTexto' => self::TEXT_ANIMS,
            'movimientos3d' => self::MOTIONS,
        ];
        $system = 'Eres editor de video para redes sociales (Reels, TikTok, historias) de '.$brand['name'].', una marca colombiana de ropa. '.
            'Conoces lo que funciona hoy: gancho en los primeros 3 segundos, ritmo, transiciones con sonido que caen en el corte, '.
            'textos cortos y legibles sin sonido, y un llamado a la acción al final. Respondes en español de Colombia y SOLO con un objeto JSON.';
        $user = "Revisa este video (tono {$tone}, formato ".($ctx['ratio'] ?? '9:16').', '.(! empty($ctx['hasMusic']) ? 'con música' : 'sin música').', '.(! empty($ctx['endCard']) ? 'con cierre de marca' : 'sin cierre').").\n".
            (! empty($ctx['brief']) ? "Objetivo del usuario: {$ctx['brief']}\n" : '').
            'Escenas en orden: '.json_encode($scenes, JSON_UNESCAPED_UNICODE)."\n".
            'Catálogo permitido (usa SOLO estos valores): '.json_encode($catalog, JSON_UNESCAPED_UNICODE)."\n".
            "Devuelve JSON con:\n".
            "- summary: 1 o 2 frases con tu diagnóstico del video\n".
            "- tips: 3 a 6 recomendaciones concretas y accionables (frases cortas)\n".
            '- scenes: una por escena, en el mismo orden: {transition, transitionSeconds (0.3 a 1.5), sound (de la lista de esa transición), '.
            'textAnim, motion (solo escenas 3d, si no null), seconds (1.5 a 12), reason (máx. 12 palabras)}. '.
            'La transición de cada escena es la que va hacia la siguiente; la de la última va hacia el cierre.';

        $r = Http::withToken($key)->timeout(40)->post('https://api.groq.com/openai/v1/chat/completions', [
            'model' => (string) config('services.groq.copy_model'),
            'temperature' => 0.6,
            'response_format' => ['type' => 'json_object'],
            'messages' => [['role' => 'system', 'content' => $system], ['role' => 'user', 'content' => $user]],
        ]);
        if (! $r->successful()) {
            throw new \RuntimeException('HTTP '.$r->status().' '.mb_substr($r->body(), 0, 200));
        }
        $data = json_decode((string) $r->json('choices.0.message.content'), true);
        if (! is_array($data) || ! is_array($data['scenes'] ?? null)) {
            throw new \RuntimeException('Respuesta sin escenas');
        }

        return $data;
    }

    /** Toma lo de la IA que sea válido; lo que falte o no exista en el catálogo sale de las reglas. */
    private function merge(array $ai, array $base, int $n): array
    {
        $out = [
            'summary' => mb_substr(trim((string) ($ai['summary'] ?? '')), 0, 400) ?: $base['summary'],
            'tips' => array_values(array_slice(array_filter(array_map(fn ($t) => mb_substr(trim((string) $t), 0, 200), (array) ($ai['tips'] ?? []))), 0, 6)) ?: $base['tips'],
            'scenes' => [],
        ];
        for ($i = 0; $i < $n; $i++) {
            $a = (array) ($ai['scenes'][$i] ?? []);
            $b = $base['scenes'][$i];
            $tr = in_array($a['transition'] ?? null, self::TRANSITIONS, true) ? $a['transition'] : $b['transition'];
            $sound = in_array($a['sound'] ?? null, self::TRANSITION_SOUNDS[$tr], true) ? $a['sound'] : self::TRANSITION_SOUNDS[$tr][0];
            $out['scenes'][] = [
                'index' => $i,
                'transition' => $tr,
                'transitionSeconds' => $this->clamp($a['transitionSeconds'] ?? null, 0.3, 1.5, $b['transitionSeconds']),
                'sound' => $sound,
                'textAnim' => in_array($a['textAnim'] ?? null, self::TEXT_ANIMS, true) ? $a['textAnim'] : $b['textAnim'],
                'motion' => $b['motion'] === null ? null : (in_array($a['motion'] ?? null, self::MOTIONS, true) ? $a['motion'] : $b['motion']),
                'seconds' => $this->clamp($a['seconds'] ?? null, 1.5, 12, $b['seconds']),
                'reason' => mb_substr(trim((string) ($a['reason'] ?? '')), 0, 120) ?: $b['reason'],
            ];
        }

        return $out;
    }

    private function clamp(mixed $v, float $min, float $max, float $default): float
    {
        return is_numeric($v) ? round(min($max, max($min, (float) $v)), 1) : $default;
    }

    /** Recomendaciones con reglas (sin IA) según el tono y el tipo de cada escena. */
    private function rules(array $ctx, array $scenes): array
    {
        $tone = (string) ($ctx['tone'] ?? 'cercano');
        $energetic = in_array($tone, ['urgente', 'divertido'], true);
        $pool = $energetic ? self::ENERGETIC : ($tone === 'cercano' ? ['empujar', 'fundido', 'deslizar', 'zoom', 'barrido', 'circulo'] : self::SOFT);
        $n = count($scenes);
        $first3d = true;
        $out = [];
        $prev = null;
        foreach ($scenes as $i => $s) {
            $kind = in_array($s['kind'] ?? '', self::SCENE_KINDS, true) ? $s['kind'] : '3d';
            $tr = $pool[$i % count($pool)];
            if ($tr === $prev) {
                $tr = $pool[($i + 1) % count($pool)];
            }
            if ($i === $n - 1) {
                $tr = ! empty($ctx['endCard']) ? ($energetic ? 'destello' : 'cortina') : 'fundido';
            }
            $prev = $tr;
            $title = trim((string) ($s['title'] ?? ''));
            $words = $title === '' ? 0 : count(preg_split('/\s+/', $title));
            $motion = null;
            if ($kind === '3d') {
                $motion = $first3d ? 'revelar' : ($i === $n - 1 ? 'orbita' : ($i % 2 ? 'detalle' : 'giroRapido'));
                $first3d = false;
            }
            $secs = (float) ($s['seconds'] ?? 3);
            $ideal = match ($kind) { 'texto' => $words <= 3 ? 1.8 : 2.6, 'foto' => $energetic ? 2.2 : 2.8, 'clip' => min(6, max(2, $secs)), default => $energetic ? 3 : 4 };
            if ($i === 0) {
                $ideal = min($ideal, 2.5);
            }
            $out[] = [
                'index' => $i,
                'transition' => $tr,
                'transitionSeconds' => $energetic ? 0.5 : ($tone === 'elegante' ? 1.0 : 0.7),
                'sound' => self::TRANSITION_SOUNDS[$tr][0],
                'textAnim' => $kind === 'texto' ? ($words <= 2 ? 'pop' : 'letras') : ($kind === 'foto' ? 'deslizar' : 'subir'),
                'motion' => $motion,
                'seconds' => round($ideal, 1),
                'reason' => $i === 0 ? 'Gancho corto: se decide en los primeros 3 segundos' : ($i === $n - 1 ? 'Cierra con fuerza antes del llamado a la acción' : ($energetic ? 'Ritmo rápido con sonido en el corte' : 'Transición suave que acompaña el tono')),
            ];
        }
        $total = array_sum(array_column($out, 'seconds')) + (! empty($ctx['endCard']) ? 2.4 : 0);
        $tips = ['Abre con lo más llamativo: la gente decide en los primeros 3 segundos si se queda.'];
        if ($total > 20) {
            $tips[] = 'El video dura más de 20 s: los reels de 7 a 15 s retienen mejor.';
        }
        if (empty($ctx['hasMusic'])) {
            $tips[] = 'Agrega música en la pestaña Audio: los reels con audio llegan a más personas.';
        }
        $long = array_filter($scenes, fn ($s) => count(preg_split('/\s+/', trim((string) ($s['title'] ?? '')))) > 6);
        if ($long) {
            $tips[] = 'Acorta los títulos largos: máximo 5 o 6 palabras para que se lean sin pausar.';
        }
        if (empty($ctx['endCard'])) {
            $tips[] = 'Activa el cierre con el logo y el botón: deja claro qué hacer después.';
        }
        $tips[] = 'Pon el sonido de cada transición justo en el corte: el editor ya lo hace por ti.';

        return [
            'summary' => $energetic
                ? 'Para un tono '.$tone.' conviene un ritmo rápido: escenas cortas, transiciones con movimiento y sonidos marcados.'
                : 'Para un tono '.$tone.' conviene un ritmo pausado: transiciones suaves, sonidos ligeros y escenas que respiren.',
            'tips' => array_slice($tips, 0, 6),
            'scenes' => $out,
        ];
    }
}
