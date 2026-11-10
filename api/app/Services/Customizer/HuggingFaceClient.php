<?php

namespace App\Services\Customizer;

use App\Exceptions\BusinessRuleException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Llamadas a Spaces de Hugging Face (Gradio) con las cuentas de config('services.huggingface.tokens').
 * Cada cuenta gratis tiene una cuota diaria de GPU (ZeroGPU): se consulta en /api/spaces/zero-gpu/quota.
 *
 * Protocolo Gradio ("/call"): subir archivos → POST call/{api} (event_id) → leer el stream SSE hasta
 * "complete" o "error" → bajar los archivos del resultado.
 */
class HuggingFaceClient
{
    /** Cuentas configuradas: [número => token] (1 = HF_TOKEN, 2 = HF_TOKEN_2…). */
    public function accounts(): array
    {
        return array_filter((array) config('services.huggingface.tokens', []), fn ($t) => is_string($t) && $t !== '');
    }

    /** Usuario de la cuenta (para mostrarlo en el admin), o null si el token no sirve. */
    public function whoami(string $token): ?string
    {
        $r = Http::withToken($token)->timeout(15)->get('https://huggingface.co/api/whoami-v2');

        return $r->successful() ? ($r->json('name') ?: null) : null;
    }

    /**
     * Cuota de GPU de la cuenta: segundos del día (base) y los que quedan (current), generaciones
     * (runs) y cuándo se renueva. Null si no se pudo consultar.
     */
    public function quota(string $token): ?array
    {
        $r = Http::withToken($token)->timeout(15)->get('https://huggingface.co/api/spaces/zero-gpu/quota');
        if (! $r->successful()) {
            return null;
        }
        $j = $r->json();

        return [
            'base' => (int) ($j['base'] ?? 0),
            'left' => max(0, (int) ($j['current'] ?? 0)),
            'resetsAt' => $j['resetsAt'] ?? null,
            'runsLimit' => (int) ($j['runs']['limit'] ?? 0),
            'runsLeft' => max(0, (int) ($j['runs']['remaining'] ?? 0)),
            'runsResetAt' => $j['runs']['resetsAt'] ?? null,
        ];
    }

    /**
     * Corre `$fn` con la primera cuenta que tenga la cuota que pide el paso; si el Space responde sin
     * cuota, prueba la siguiente. Devuelve [resultado, número de cuenta].
     */
    public function withAccount(int $seconds, callable $fn): array
    {
        $accounts = $this->accounts();
        if (! $accounts) {
            throw new BusinessRuleException('No hay cuentas de Hugging Face configuradas (HF_TOKEN en el .env de la API)', 422);
        }
        $last = null;
        foreach ($accounts as $n => $token) {
            $q = $this->quota($token);
            if ($q !== null && ($q['left'] < $seconds || $q['runsLeft'] < 1)) {
                $last = "la cuenta {$n} tiene {$q['left']} s y este paso pide {$seconds} s";
                continue;
            }
            try {
                return [$fn($token), $n];
            } catch (\RuntimeException $e) {
                $quota = str_contains($e->getMessage(), 'cuota') || str_contains(strtolower($e->getMessage()), 'quota');
                // Algunos Spaces no dicen el motivo: si a la cuenta ya no le alcanza, era la cuota.
                if (! $quota && ($q2 = $this->quota($token)) !== null && $q2['left'] < $seconds) {
                    $quota = true;
                }
                if (! $quota) {
                    throw $e;
                }
                $last = $e->getMessage();
            }
        }
        throw new \RuntimeException('Ninguna cuenta tiene cuota de GPU suficiente hoy ('.$last.'). La cuota se renueva cada día.');
    }

    /** Host del Space (https://owner-name.hf.space), prefijo de su API según la versión de Gradio y su config. */
    private function space(string $space, string $token): array
    {
        $info = Http::withToken($token)->timeout(20)->get("https://huggingface.co/api/spaces/{$space}");
        if (! $info->successful()) {
            throw new RuntimeException("No se encontró el Space {$space}");
        }
        $stage = $info->json('runtime.stage');
        if ($stage !== 'RUNNING') {
            throw new RuntimeException("El servicio {$space} no está disponible ahora (estado: {$stage}). Intenta más tarde.");
        }
        $host = rtrim((string) ($info->json('host') ?: 'https://'.str_replace(['/', '.', '_'], '-', strtolower($space)).'.hf.space'), '/');
        $config = Http::withToken($token)->timeout(30)->get("{$host}/config");
        $prefix = $config->successful() ? (string) ($config->json('api_prefix') ?? '') : '';
        if ($prefix === '' && version_compare((string) ($config->json('version') ?? '4'), '5', '>=')) {
            $prefix = '/gradio_api';
        }

        return [$host, rtrim($prefix, '/'), $config->successful() ? (array) $config->json() : []];
    }

    /**
     * Posiciones de las entradas y salidas ocultas (gr.State) del endpoint: la API pública no las muestra
     * pero el Space las espera en la lista (el cliente oficial de Gradio las completa con null).
     */
    private function stateSlots(array $config, string $api): array
    {
        $types = [];
        foreach ($config['components'] ?? [] as $c) {
            $types[$c['id'] ?? -1] = $c['type'] ?? '';
        }
        foreach ($config['dependencies'] ?? [] as $d) {
            if (($d['api_name'] ?? null) === $api) {
                $pick = fn (array $ids) => array_keys(array_filter($ids, fn ($id) => ($types[$id] ?? '') === 'state'));

                return [$pick($d['inputs'] ?? []), $pick($d['outputs'] ?? [])];
            }
        }

        return [[], []];
    }

    /**
     * Ejecuta un endpoint del Space. `$data` es la lista de argumentos; un argumento
     * ['__file' => ruta local] se sube antes y se manda como archivo de Gradio.
     * Devuelve la lista de salidas (los archivos como ['url' => …, 'path' => …]).
     *
     * @throws RuntimeException con el mensaje del Space (p. ej. sin cuota de GPU)
     */
    public function run(string $space, string $api, array $data, string $token, int $timeout = 900): array
    {
        [$host, $prefix, $config] = $this->space($space, $token);
        $base = $host.$prefix;
        $api = ltrim($api, '/');
        [$stateIn, $stateOut] = $this->stateSlots($config, $api);

        foreach ($data as $i => $arg) {
            if (is_array($arg) && isset($arg['__file'])) {
                $data[$i] = $this->upload($base, $arg['__file'], $token);
            }
        }

        $data = array_values($data);
        foreach ($stateIn as $pos) {
            array_splice($data, $pos, 0, [null]);
        }
        $start = Http::withToken($token)->timeout(60)->post("{$base}/call/{$api}", ['data' => $data]);
        if (! $start->successful() || ! $start->json('event_id')) {
            throw new RuntimeException('El servicio no aceptó la tarea: '.$start->status().' '.mb_substr($start->body(), 0, 300));
        }

        $out = $this->listen("{$base}/call/{$api}/".$start->json('event_id'), $token, $timeout);
        foreach (array_reverse($stateOut) as $pos) {
            array_splice($out, $pos, 1);
        }

        return array_map(fn ($v) => $this->fileOf($v, $base) ?? $v, $out);
    }

    /** Baja un archivo del resultado a `$dest`. */
    public function download(array $file, string $dest, string $token): void
    {
        // Hasta 3 intentos: a veces el Space corta la primera descarga.
        for ($try = 1; $try <= 3; $try++) {
            try {
                $r = Http::withToken($token)->timeout(300)->sink($dest)->get($file['url']);
                if ($r->successful() && is_file($dest) && filesize($dest) > 0) {
                    return;
                }
            } catch (\Throwable) {
                // se reintenta
            }
            @unlink($dest);
            usleep(1_500_000);
        }
        throw new RuntimeException('No se pudo descargar el resultado del servicio');
    }

    private function upload(string $base, string $path, string $token): array
    {
        if (! is_file($path)) {
            throw new BusinessRuleException('No se encontró la imagen para generar el modelo', 400);
        }
        $r = Http::withToken($token)->timeout(120)
            ->attach('files', file_get_contents($path), basename($path))
            ->post("{$base}/upload");
        $remote = $r->json('0');
        if (! $r->successful() || ! is_string($remote)) {
            throw new RuntimeException('No se pudo subir la imagen al servicio: '.$r->status());
        }

        return ['path' => $remote, 'orig_name' => basename($path), 'meta' => ['_type' => 'gradio.FileData']];
    }

    /** Lee el stream SSE hasta el evento final. */
    private function listen(string $url, string $token, int $timeout): array
    {
        $response = Http::withToken($token)->timeout($timeout)->withOptions(['stream' => true])->get($url);
        $body = $response->toPsrResponse()->getBody();
        $buffer = '';
        $event = null;
        $deadline = time() + $timeout;
        while (! $body->eof()) {
            if (time() > $deadline) {
                throw new RuntimeException('El servicio tardó demasiado en responder');
            }
            $buffer .= $body->read(8192);
            while (($nl = strpos($buffer, "\n")) !== false) {
                $line = rtrim(substr($buffer, 0, $nl), "\r");
                $buffer = substr($buffer, $nl + 1);
                if (str_starts_with($line, 'event:')) {
                    $event = trim(substr($line, 6));
                } elseif (str_starts_with($line, 'data:')) {
                    $payload = json_decode(trim(substr($line, 5)), true);
                    if ($event === 'complete') {
                        return is_array($payload) ? $payload : [];
                    }
                    if ($event === 'error') {
                        throw new RuntimeException($this->errorText($payload));
                    }
                }
            }
        }
        throw new RuntimeException('El servicio cortó la conexión sin terminar el modelo');
    }

    private function errorText(mixed $payload): string
    {
        $msg = is_string($payload) ? $payload : (is_array($payload) ? (string) ($payload['message'] ?? $payload['error'] ?? json_encode($payload)) : '');
        if ($msg === '' || $msg === 'null') {
            return 'El servicio de generación falló. Prueba con otra foto o más tarde.';
        }
        if (preg_match('/\((\d+)s requested vs\. (-?\d+)s left\)/', $msg, $m)) {
            return "Sin cuota de GPU en la cuenta (pide {$m[1]} s y le quedan ".max(0, (int) $m[2]).' s).';
        }

        return mb_substr($msg, 0, 500);
    }

    /** Archivo de Gradio → ['url', 'path'] con URL absoluta. */
    private function fileOf(mixed $v, string $base): ?array
    {
        if (! is_array($v)) {
            return null;
        }
        if (isset($v['value']) && is_array($v['value'])) {
            $v = $v['value'];
        }
        if (! isset($v['path']) && ! isset($v['url'])) {
            return null;
        }
        // Se arma desde la ruta: Gradio 4 devuelve a veces la URL con la ruta de la llamada (/call/…/file=).
        $url = isset($v['path']) ? "{$base}/file={$v['path']}" : $v['url'];

        return ['url' => $url, 'path' => $v['path'] ?? null];
    }
}
