<?php

namespace App\Services\Customizer;

use App\Exceptions\BusinessRuleException;
use App\Models\MannequinModel;
use App\Models\Product;
use App\Services\Settings\ImageUploadService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Maniquíes 3D generados desde el admin (Modelos 3D).
 *
 * Flujo: el admin sube una foto (o 4 vistas, o lo describe) → se crea el registro "generando" y se
 * lanza la generación en segundo plano (comando mannequin:generate) → la IA de Hugging Face arma el
 * .glb → queda "revision": el admin lo mira en el visor, ajusta dónde termina la tela y guarda la foto
 * de carga → al publicarlo se puede elegir en "Modelo 3D" de las plantillas.
 *
 * Los dos maniquíes del sistema (basica, oversize) siguen en el código (TemplateController::MODELS_3D).
 */
class MannequinModelService
{
    /** Spaces que generan (gratis, con cuota de GPU por cuenta). */
    public const SPACE_PHOTO = 'tencent/Hunyuan3D-2.1';

    public const SPACE_VIEWS = 'tencent/Hunyuan3D-2mv';

    /** Segundos de GPU que pide cada paso (lo que el Space reserva de la cuota). */
    public const GPU_SECONDS = ['photo' => 270, 'views' => 270, 'text' => 60, 'edit' => 90];

    public const VIEWS = ['front', 'back', 'left', 'right'];

    /** Una generación que no termina en este tiempo se da por caída. */
    private const STALE_MINUTES = 25;

    /**
     * Dónde termina la tela en el maniquí (fracciones del alto, 0 = abajo). Mismos campos que
     * ModelConfig del front; los valores por defecto son los de la Básica original.
     */
    public const DEFAULT_CONFIG = [
        // maniqui (prenda de arriba en torso) | cabeza (gorra, sombrero) | piernas (pantalón, short) |
        // objeto (sin maniquí). Ver MannequinStandard.
        'kind' => 'maniqui',
        // Cabeza y piernas: la tela se separa del maniquí por color (lo claro de la textura es la
        // prenda, que sale blanca en la foto estándar) o por altura (por encima de clothFrom).
        'split' => 'color',
        'lightFrom' => 0.62,
        'clothFrom' => 0.5,
        // Giro del modelo en grados (-180..180) para que su frente mire al frente (la IA lo puede
        // generar de lado).
        'yaw' => 0,
        'headFrom' => 0.767, 'bodyTop' => 0.681, 'collarFront' => 0.748, 'collarBack' => 0.76,
        'collarCurve' => 1, 'hem' => 0.143, 'cut' => 0, 'sleeveY' => 0.655,
    ];

    public function __construct(
        private HuggingFaceClient $hf,
        private ImageUploadService $uploads,
        private MannequinGenerationLauncher $launcher,
    ) {}

    public function format(MannequinModel $m): array
    {
        return [
            'id' => $m->id,
            'key' => $m->key,
            'name' => $m->name,
            'status' => $m->status,
            'source' => $m->source,
            'prompt' => $m->prompt,
            'quality' => $m->quality,
            'inputImages' => array_map(fn ($p) => '/'.ltrim($p, '/'), $m->inputImages ?? []),
            'model' => $m->glbPath ? '/'.$m->glbPath : null,
            'poster' => $m->posterPath ? '/'.$m->posterPath : null,
            'config' => array_merge(self::DEFAULT_CONFIG, $m->config ?? []),
            'error' => $m->error,
            'account' => $m->account,
            'seconds' => $m->seconds,
            'startedAt' => $m->startedAt?->toIso8601String(),
            'finishedAt' => $m->finishedAt?->toIso8601String(),
            'templates' => $m->key ? Product::where('model3d', $m->key)->count() : 0,
            'createdAt' => $m->createdAt,
        ];
    }

    /** Todos (admin), los más nuevos primero. Marca como caídas las generaciones colgadas. */
    public function list(): array
    {
        MannequinModel::where('status', MannequinModel::GENERATING)
            ->where('startedAt', '<', now()->subMinutes(self::STALE_MINUTES))
            ->update(['status' => MannequinModel::FAILED, 'error' => 'La generación se interrumpió. Vuelve a intentarlo.', 'finishedAt' => now()]);

        return MannequinModel::orderByDesc('id')->get()->map(fn ($m) => $this->format($m))->all();
    }

    public function find(int $id): MannequinModel
    {
        $m = MannequinModel::find($id);
        if (! $m) {
            throw new BusinessRuleException('Modelo 3D no encontrado', 404);
        }

        return $m;
    }

    /** Publicados: los que la tienda y las plantillas pueden usar. */
    public function publicList(): array
    {
        return MannequinModel::where('status', MannequinModel::PUBLISHED)->orderBy('name')->get()
            ->map(fn ($m) => [
                'key' => $m->key, 'name' => $m->name,
                'model' => '/'.$m->glbPath, 'poster' => $m->posterPath ? '/'.$m->posterPath : null,
                'config' => array_merge(self::DEFAULT_CONFIG, $m->config ?? []),
            ])->all();
    }

    /** Claves que puede guardar products.model3d además de las del sistema. */
    public function publishedKeys(): array
    {
        return MannequinModel::where('status', MannequinModel::PUBLISHED)->pluck('key')->filter()->values()->all();
    }

    /** Cuota de GPU de cada cuenta de Hugging Face (se consulta en vivo, con 30 s de caché). */
    public function accounts(bool $fresh = false): array
    {
        $out = [];
        foreach ($this->hf->accounts() as $n => $token) {
            $key = 'hf-account-'.$n.'-'.substr(hash('sha256', $token), 0, 12);
            if ($fresh) {
                Cache::forget($key);
            }
            $out[] = Cache::remember($key, 30, function () use ($n, $token) {
                $q = $this->hf->quota($token);

                return [
                    'account' => (int) $n,
                    'user' => $this->hf->whoami($token),
                    'ok' => $q !== null,
                ] + ($q ?? ['base' => 0, 'left' => 0, 'resetsAt' => null, 'runsLimit' => 0, 'runsLeft' => 0, 'runsResetAt' => null]);
            });
        }

        return [
            'accounts' => $out,
            'needs' => self::GPU_SECONDS,
            'totalLeft' => array_sum(array_column($out, 'left')),
        ];
    }

    /**
     * Crea el modelo como borrador: todavía no gasta GPU. Lo que se genera se pide en su chat
     * (MannequinEditService), paso a paso.
     */
    public function createDraft(string $name, ?string $kind, string $prompt, ?int $userId): array
    {
        $m = MannequinModel::create([
            'name' => trim($name),
            'status' => MannequinModel::DRAFT,
            'source' => 'foto',
            'prompt' => $prompt !== '' ? $prompt : null,
            'quality' => 'normal',
            'inputImages' => [],
            'config' => array_merge(self::DEFAULT_CONFIG, ['kind' => MannequinStandard::kind($kind)]),
            'createdBy' => $userId,
        ]);
        $m->update(['key' => 'm'.$m->id]);

        return $this->format($m->fresh());
    }

    /**
     * Genera el 3D desde el chat: con una foto ('foto') o con las 4 vistas aprobadas ('vistas').
     *
     * @param  array<string,string>  $images  front (y back, left, right con 4 vistas), rutas en uploads
     */
    public function regenerate(MannequinModel $m, string $source, array $images): void
    {
        if (! in_array($m->status, [MannequinModel::DRAFT, MannequinModel::FAILED, MannequinModel::REVIEW], true)) {
            throw new BusinessRuleException($m->status === MannequinModel::PUBLISHED
                ? 'Está publicado: despublícalo antes de cambiar el modelo 3D'
                : 'Espera a que termine la generación actual', 409);
        }
        $m->update([
            'source' => $source, 'inputImages' => array_map(fn ($p) => ltrim($p, '/'), $images),
            'status' => MannequinModel::GENERATING, 'error' => null, 'startedAt' => now(), 'finishedAt' => null, 'seconds' => null,
        ]);
        $this->launcher->launch($m->id);
    }

    /** Vuelve a generar uno que falló (o uno en revisión que no gustó). */
    public function retry(int $id): array
    {
        $m = $this->find($id);
        if (! in_array($m->status, [MannequinModel::FAILED, MannequinModel::REVIEW], true) || empty($m->inputImages['front'])) {
            throw new BusinessRuleException('Solo se vuelve a generar un modelo con error o en revisión que ya tenga fotos', 409);
        }
        $m->update(['status' => MannequinModel::GENERATING, 'error' => null, 'startedAt' => now(), 'finishedAt' => null, 'seconds' => null]);
        $this->launcher->launch($m->id);

        return $this->format($m->fresh());
    }

    /**
     * Guarda la revisión: nombre, ajustes de la tela, foto de carga y publicar o no.
     *
     * @param  array{name?:string, config?:array, poster?:?string, published?:bool}  $data
     */
    public function update(int $id, array $data): array
    {
        $m = $this->find($id);
        if (in_array($m->status, [MannequinModel::DRAFT, MannequinModel::GENERATING, MannequinModel::FAILED], true) || ! $m->glbPath) {
            throw new BusinessRuleException('El modelo todavía no está listo para revisar', 409);
        }
        $changes = [];
        if (isset($data['name'])) {
            $changes['name'] = trim($data['name']);
        }
        if (isset($data['config'])) {
            $changes['config'] = $this->cleanConfig($data['config']);
        }
        if (! empty($data['poster'])) {
            $saved = $this->uploads->store($this->uploads->decodeBase64($data['poster']), 'models3d', $m->key.'-foto');
            $this->removeFile($m->posterPath);
            $changes['posterPath'] = ltrim($saved['url'], '/');
        }
        if (array_key_exists('published', $data)) {
            if ($data['published']) {
                if (! ($changes['posterPath'] ?? $m->posterPath)) {
                    throw new BusinessRuleException('Guarda la foto de carga antes de publicar', 422);
                }
                $changes['status'] = MannequinModel::PUBLISHED;
            } else {
                $used = Product::where('model3d', $m->key)->count();
                if ($used > 0) {
                    throw new BusinessRuleException("No se puede despublicar: lo usan {$used} plantilla(s). Cámbialas primero.", 409);
                }
                $changes['status'] = MannequinModel::REVIEW;
            }
        }
        $m->update($changes);

        return $this->format($m->fresh());
    }

    public function delete(int $id): void
    {
        $m = $this->find($id);
        $used = $m->key ? Product::where('model3d', $m->key)->count() : 0;
        if ($used > 0) {
            throw new BusinessRuleException("No se puede eliminar: lo usan {$used} plantilla(s). Cámbialas primero.", 409);
        }
        if ($m->status === MannequinModel::GENERATING) {
            throw new BusinessRuleException('Espera a que termine la generación para eliminarlo', 409);
        }
        $this->removeFile($m->glbPath);
        $this->removeFile($m->posterPath);
        foreach ($m->inputImages ?? [] as $path) {
            $this->removeFile($path);
        }
        foreach (\App\Models\MannequinModelEdit::where('modelId', $m->id)->pluck('imagePath')->filter() as $path) {
            $this->removeFile($path);
        }
        $m->delete();
    }

    /**
     * La generación (corre en segundo plano, comando mannequin:generate). Elige una cuenta con cuota,
     * genera y guarda el .glb; si una cuenta se queda sin cuota sigue con la siguiente.
     */
    public function generate(int $id): void
    {
        $m = $this->find($id);
        if ($m->status !== MannequinModel::GENERATING) {
            return;
        }
        $t0 = microtime(true);
        try {
            $glb = $this->runGeneration($m);
            $m->update([
                'status' => MannequinModel::REVIEW, 'glbPath' => $glb, 'error' => null,
                'seconds' => (int) round(microtime(true) - $t0), 'finishedAt' => now(),
            ]);
        } catch (Throwable $e) {
            Log::warning('Modelo 3D '.$m->id.': '.$e->getMessage());
            $m->update([
                'status' => MannequinModel::FAILED, 'error' => mb_substr($e->getMessage(), 0, 1000),
                'seconds' => (int) round(microtime(true) - $t0), 'finishedAt' => now(),
            ]);
        }
    }

    private function runGeneration(MannequinModel $m): string
    {
        $q = $m->quality === 'alta' ? ['steps' => 50, 'octree' => 384] : ['steps' => 30, 'octree' => 256];
        $seed = random_int(1, 2_000_000_000);

        if ($m->source === 'vistas') {
            $imgs = array_map(fn ($p) => ['__file' => public_path($p)], $m->inputImages);
            [$out, $account] = $this->hf->withAccount(self::GPU_SECONDS['views'], fn ($token) => $this->hf->run(
                self::SPACE_VIEWS, '/generation_all',
                [null, null, $imgs['front'], $imgs['back'], $imgs['left'], $imgs['right'], $q['steps'], 5.0, $seed, $q['octree'], true, 8000, false],
                $token,
            ));
        } else {
            $photo = public_path($m->inputImages['front'] ?? '');
            [$out, $account] = $this->hf->withAccount(self::GPU_SECONDS['photo'], fn ($token) => $this->hf->run(
                self::SPACE_PHOTO, '/generation_all',
                [['__file' => $photo], null, null, null, null, $q['steps'], 5.5, $seed, $q['octree'], true, 8000, false],
                $token,
            ));
        }

        // Salidas: [forma, forma con textura, …]. Se prefiere la de textura (se ve igual en otros programas).
        $file = (is_array($out[1] ?? null) && isset($out[1]['url'])) ? $out[1] : ($out[0] ?? null);
        if (! is_array($file) || ! isset($file['url'])) {
            throw new \RuntimeException('El servicio no devolvió el modelo 3D');
        }
        $rel = "uploads/models3d/{$m->key}-".time().'.glb';
        $this->ensureDir();
        $this->hf->download($file, public_path($rel), $this->hf->accounts()[$account]);
        $this->assertGlb(public_path($rel));
        $this->removeFile($m->glbPath);
        $m->update(['account' => $account]);

        return $rel;
    }

    private function cleanConfig(array $c): array
    {
        $out = self::DEFAULT_CONFIG;
        $out['kind'] = MannequinStandard::kind($c['kind'] ?? null);
        $out['split'] = ($c['split'] ?? 'color') === 'altura' ? 'altura' : 'color';
        foreach (self::DEFAULT_CONFIG as $k => $_) {
            if ($k === 'kind' || $k === 'split' || ! isset($c[$k]) || ! is_numeric($c[$k])) {
                continue;
            }
            $out[$k] = match ($k) {
                'collarCurve' => in_array((int) $c[$k], [1, 2], true) ? (int) $c[$k] : 1,
                'yaw' => (int) round(min(180, max(-180, (float) $c[$k]))),
                default => round(min(1, max(0, (float) $c[$k])), 4),
            };
        }

        return $out;
    }

    private function assertGlb(string $path): void
    {
        $head = @file_get_contents($path, false, null, 0, 4);
        if ($head !== 'glTF') {
            @unlink($path);
            throw new \RuntimeException('El archivo que devolvió el servicio no es un modelo .glb');
        }
    }

    private function ensureDir(): void
    {
        $dir = public_path('uploads/models3d');
        if (! is_dir($dir) && ! @mkdir($dir, 0775, true) && ! is_dir($dir)) {
            throw new \RuntimeException('No se pudo crear la carpeta uploads/models3d');
        }
    }

    private function removeFile(?string $rel): void
    {
        if (! $rel) {
            return;
        }
        $clean = ltrim(str_replace('..', '', $rel), '/');
        if (str_starts_with($clean, 'uploads/models3d/') && is_file(public_path($clean))) {
            @unlink(public_path($clean));
        }
    }
}
