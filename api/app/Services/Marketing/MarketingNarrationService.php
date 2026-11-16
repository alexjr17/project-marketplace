<?php

namespace App\Services\Marketing;

use App\Exceptions\BusinessRuleException;
use App\Services\Customizer\HuggingFaceClient;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Narrador de los videos del estudio:
 * - guion: la IA escribe lo que se dice en cada escena, del largo que cabe en su duración
 *   (unas 2,5 palabras por segundo), en el tono de la marca; sin IA, sale de los textos de las escenas;
 * - voz: lee una línea con voces neuronales en español (Edge TTS en un Space de Hugging Face, sin
 *   GPU). Cada audio queda en caché por texto, voz y velocidad para no pedirlo dos veces.
 */
class MarketingNarrationService
{
    /** Voces disponibles: id → nombre para mostrar. */
    public const VOICES = [
        'es-CO-SalomeNeural' => 'Salomé · Colombia · mujer',
        'es-CO-GonzaloNeural' => 'Gonzalo · Colombia · hombre',
        'es-MX-DaliaNeural' => 'Dalia · México · mujer',
        'es-MX-JorgeNeural' => 'Jorge · México · hombre',
        'es-AR-ElenaNeural' => 'Elena · Argentina · mujer',
        'es-AR-TomasNeural' => 'Tomás · Argentina · hombre',
        'es-CL-CatalinaNeural' => 'Catalina · Chile · mujer',
        'es-ES-XimenaNeural' => 'Ximena · España · mujer',
    ];

    private const FEMALE = ['es-CO-SalomeNeural', 'es-MX-DaliaNeural', 'es-AR-ElenaNeural', 'es-CL-CatalinaNeural', 'es-ES-XimenaNeural'];

    private const SPACE = 'innoai/Edge-TTS-Text-to-Speech';

    /** Palabras que se alcanzan a decir por segundo, con calma. */
    private const WORDS_PER_SECOND = 2.5;

    public function __construct(private MarketingBrandService $brandKit, private HuggingFaceClient $hf) {}

    public function voices(): array
    {
        return array_map(fn ($id, $name) => ['id' => $id, 'name' => $name], array_keys(self::VOICES), self::VOICES);
    }

    /**
     * @param  array{tone?:string, brief?:string, scenes:array<int,array{kind:string,about?:string,title?:string,seconds:float}>}  $ctx
     * @return array{ai:bool, lines:array<int,string>}
     */
    public function script(array $ctx): array
    {
        $scenes = array_values(array_slice($ctx['scenes'], 0, 12));
        $key = (string) config('services.groq.key');
        if ($key !== '') {
            try {
                return ['ai' => true, 'lines' => $this->fit($this->withGroq($key, $ctx, $scenes), $scenes)];
            } catch (Throwable $e) {
                Log::warning('[Marketing] Guion de narración: '.$e->getMessage());
            }
        }

        return ['ai' => false, 'lines' => $this->fit($this->fallback($scenes), $scenes)];
    }

    private function withGroq(string $key, array $ctx, array $scenes): array
    {
        $brand = $this->brandKit->get();
        $tone = (string) ($ctx['tone'] ?? ($brand['voice']['tone'] ?? 'cercano'));
        $plan = array_map(fn ($s, $i) => [
            'escena' => $i + 1,
            'tipo' => $s['kind'],
            'muestra' => $s['about'] ?? '',
            'textoEnPantalla' => $s['title'] ?? '',
            'maxPalabras' => max(3, (int) floor(((float) $s['seconds']) * self::WORDS_PER_SECOND)),
        ], $scenes, array_keys($scenes));
        $system = "Eres el locutor de {$brand['name']}, una marca colombiana de ropa".
            (! empty($brand['voice']['personality']) ? " ({$brand['voice']['personality']})" : '').
            '. Escribes guiones de voz en off para reels: frases naturales para decir en voz alta, en español de Colombia, '.
            'sin emojis, sin hashtags ni símbolos, sin inventar precios ni datos. Respondes SOLO con un objeto JSON.';
        $user = "Escribe la narración de este video, en tono {$tone}. Una línea por escena, que juntas cuenten una historia: ".
            'la primera engancha, las del medio muestran beneficios y la última invita a comprar o a personalizar. '.
            'Respeta maxPalabras de cada escena (se lee mientras dura la escena). Si una escena no necesita voz, deja la línea vacía.'.
            (! empty($ctx['brief']) ? "\nIndicaciones: {$ctx['brief']}" : '').
            "\nEscenas: ".json_encode($plan, JSON_UNESCAPED_UNICODE).
            "\nDevuelve JSON: {\"lines\": [\"texto escena 1\", \"texto escena 2\", ...]} con exactamente ".count($scenes).' elementos.';

        $r = Http::withToken($key)->timeout(40)->post('https://api.groq.com/openai/v1/chat/completions', [
            'model' => (string) config('services.groq.copy_model'),
            'temperature' => 0.7,
            'response_format' => ['type' => 'json_object'],
            'messages' => [['role' => 'system', 'content' => $system], ['role' => 'user', 'content' => $user]],
        ]);
        if (! $r->successful()) {
            throw new \RuntimeException('HTTP '.$r->status().' '.mb_substr($r->body(), 0, 200));
        }
        $data = json_decode((string) $r->json('choices.0.message.content'), true);
        if (! is_array($data['lines'] ?? null)) {
            throw new \RuntimeException('Respuesta sin líneas');
        }

        return array_values($data['lines']);
    }

    /** Sin IA: lo que dice cada escena sale de sus textos. */
    private function fallback(array $scenes): array
    {
        $n = count($scenes);

        return array_map(function ($s, $i) use ($n) {
            $t = trim((string) ($s['title'] ?? ''));
            $a = trim((string) ($s['about'] ?? ''));
            if ($i === $n - 1) {
                return $t !== '' ? $t.'. Encuéntralo en nuestra tienda.' : 'Encuéntralo en nuestra tienda.';
            }

            return $t !== '' ? $t.'.' : ($a !== '' ? $a.'.' : '');
        }, $scenes, array_keys($scenes));
    }

    /** Una línea por escena, limpia y que quepa en la duración de la escena. */
    private function fit(array $lines, array $scenes): array
    {
        $out = [];
        foreach ($scenes as $i => $s) {
            $text = trim(preg_replace('/[#*_~`>\[\]{}|]/u', '', (string) ($lines[$i] ?? '')));
            $text = preg_replace('/\s+/u', ' ', $text);
            $max = max(3, (int) floor(((float) $s['seconds']) * self::WORDS_PER_SECOND) + 2);
            $words = preg_split('/\s+/u', $text, -1, PREG_SPLIT_NO_EMPTY);
            if (count($words) > $max) {
                $text = rtrim(implode(' ', array_slice($words, 0, $max)), ',;:').'…';
            }
            $out[] = mb_substr($text, 0, 300);
        }

        return $out;
    }

    /**
     * Audio (MP3) de una línea con la voz elegida. `rate`: -30..30 (% más lento o más rápido).
     *
     * @return array{0:string,1:string} [bytes, content-type]
     */
    public function speak(string $text, string $voice, int $rate = 0): array
    {
        if (! isset(self::VOICES[$voice])) {
            throw new BusinessRuleException('Esa voz no está disponible', 422);
        }
        $text = trim(preg_replace('/\s+/u', ' ', $text));
        if ($text === '') {
            throw new BusinessRuleException('No hay texto para leer', 422);
        }
        $rate = max(-30, min(30, $rate));
        $path = 'tts/'.sha1($voice.'|'.$rate.'|'.$text).'.mp3';
        $disk = Storage::disk('local');
        if ($disk->exists($path)) {
            return [$disk->get($path), 'audio/mpeg'];
        }

        $tokens = $this->hf->accounts();
        if (! $tokens) {
            throw new BusinessRuleException('La voz automática necesita una cuenta de Hugging Face (HF_TOKEN en el .env de la API)', 422);
        }
        $label = $voice.' - '.substr($voice, 0, 5).' ('.(in_array($voice, self::FEMALE, true) ? 'Female' : 'Male').')';
        $last = null;
        foreach ($tokens as $token) {
            try {
                $out = $this->hf->run(self::SPACE, '/tts_interface', [$text, $label, $rate, 0], $token, 120);
                $file = $out[0] ?? null;
                if (! is_array($file) || empty($file['url'])) {
                    throw new \RuntimeException(is_string($out[1] ?? null) && $out[1] !== '' ? strip_tags($out[1]) : 'El servicio de voz no devolvió audio');
                }
                $tmp = tempnam(sys_get_temp_dir(), 'tts');
                $this->hf->download($file, $tmp, $token);
                $bytes = (string) file_get_contents($tmp);
                @unlink($tmp);
                $disk->put($path, $bytes);

                return [$bytes, 'audio/mpeg'];
            } catch (Throwable $e) {
                $last = $e->getMessage();
                Log::warning('[Marketing] Voz: '.$last);
            }
        }
        throw new BusinessRuleException('No se pudo generar la voz ahora ('.mb_substr((string) $last, 0, 160).'). Intenta de nuevo o graba tu voz.', 502);
    }
}
