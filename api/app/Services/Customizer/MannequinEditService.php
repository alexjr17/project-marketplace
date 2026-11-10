<?php

namespace App\Services\Customizer;

use App\Exceptions\BusinessRuleException;
use App\Models\MannequinModel;
use App\Models\MannequinModelEdit;
use App\Services\Settings\ImageUploadService;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Chat para definir un modelo 3D: todo se genera desde aquí, paso a paso y a pedido del admin, para no
 * gastar GPU sin saber qué se va a generar.
 *
 * 1. Cada mensaje es texto y/o una foto de referencia. Con foto, la IA pasa ese producto al maniquí
 *    estándar de su tipo (MannequinStandard); sin foto, cambia la última foto (o una anterior elegida);
 *    el primero sin foto la crea desde la descripción.
 * 2. Con la foto que quede bien se aprueba y se arman las otras 3 vistas (espalda y lados), que se pueden
 *    rehacer una por una.
 * 3. Con las 4 vistas se genera el 3D multivista (respeta la espalda y los lados, no los inventa).
 *
 * Lo escrito en español se traduce al inglés con un traductor gratis (sin GPU).
 */
class MannequinEditService
{
    /** Edición de fotos guiada por texto (foto + instrucción). */
    public const SPACE_EDIT = 'black-forest-labs/FLUX.1-Kontext-Dev';

    /** Foto desde texto (primer mensaje sin foto). */
    public const SPACE_TEXT = 'black-forest-labs/FLUX.1-schnell';

    /** Traductor (CPU, sin cuota de GPU). */
    public const SPACE_TRANSLATE = 'Helsinki-NLP/opus-translate';

    /** Si una foto no termina en este tiempo se da por caída (las 3 vistas van una tras otra). */
    private const STALE_MINUTES = 15;

    public function __construct(
        private HuggingFaceClient $hf,
        private MannequinModelService $models,
        private MannequinGenerationLauncher $launcher,
        private ImageUploadService $uploads,
    ) {}

    public function format(MannequinModelEdit $e): array
    {
        return [
            'id' => $e->id,
            'prompt' => $e->prompt,
            'mode' => $e->mode,
            'view' => $e->view,
            'status' => $e->status,
            'initial' => (bool) $e->initial,
            'image' => $e->imagePath ? '/'.$e->imagePath : null,
            'base' => $e->basePath ? '/'.$e->basePath : null,
            'error' => $e->error,
            'account' => $e->account,
            'seconds' => $e->seconds,
            'applied' => (bool) $e->applied,
            'createdAt' => $e->createdAt,
        ];
    }

    /** Crea el modelo (borrador) y manda su primer mensaje al chat. */
    public function createModel(array $data, ?int $userId): array
    {
        $prompt = trim((string) ($data['prompt'] ?? ''));
        if ($prompt === '' && empty($data['image'])) {
            throw new BusinessRuleException('Escribe la descripción o sube una foto de referencia', 422, ['prompt' => ['Escribe la descripción o sube una foto']]);
        }
        $m = $this->models->createDraft($data['name'], $data['kind'] ?? null, $prompt, $userId);
        $this->send($m['id'], $prompt, $data['image'] ?? null, null, $userId, true);

        return $this->models->format($this->models->find($m['id']));
    }

    /** Mensajes del chat de un modelo, del más viejo al más nuevo (incluye las vistas). */
    public function list(int $modelId): array
    {
        $this->models->find($modelId);
        MannequinModelEdit::where('modelId', $modelId)->where('status', MannequinModelEdit::PROCESSING)
            ->where('createdAt', '<', now()->subMinutes(self::STALE_MINUTES))
            ->update(['status' => MannequinModelEdit::FAILED, 'error' => 'Se interrumpió. Vuelve a intentarlo.']);

        return MannequinModelEdit::where('modelId', $modelId)->orderBy('id')->get()->map(fn ($e) => $this->format($e))->all();
    }

    /**
     * Nuevo mensaje. Con `image` (foto de referencia): ese producto pasa al maniquí estándar, con lo que
     * diga el texto. Sin foto: cambio sobre `fromEditId` o sobre la última foto que salió bien.
     */
    public function create(int $modelId, string $prompt, ?string $image, ?int $fromEditId, ?int $userId): array
    {
        return $this->send($modelId, trim($prompt), $image, $fromEditId, $userId, false);
    }

    /**
     * Aprueba una foto del chat como frente y arma las otras 3 vistas (una tras otra, en segundo plano).
     */
    public function approve(int $modelId, int $editId): array
    {
        $m = $this->editable($modelId);
        $e = $this->doneEdit($m, $editId);
        if ($e->mode === 'view') {
            throw new BusinessRuleException('Aprueba una foto de frente del chat', 422);
        }
        $this->assertIdle($m);
        $m->update(['inputImages' => ['front' => $e->imagePath]]);
        $first = null;
        foreach (MannequinStandard::VIEWS as $view) {
            $v = MannequinModelEdit::create([
                'modelId' => $m->id, 'mode' => 'view', 'view' => $view, 'prompt' => '', 'status' => MannequinModelEdit::PROCESSING,
                'basePath' => $e->imagePath, 'createdBy' => $e->createdBy,
            ]);
            $first ??= $v;
        }
        $this->launcher->launch($first->id, 'mannequin:edit');

        return $this->list($m->id);
    }

    /** Rehace una vista (espalda o un lado), con un pedido opcional ("que se vea el broche"). */
    public function redoView(int $modelId, string $view, string $prompt, ?int $userId): array
    {
        $m = $this->editable($modelId);
        if (! in_array($view, MannequinStandard::VIEWS, true)) {
            throw new BusinessRuleException('Vista no válida', 422);
        }
        $front = $m->inputImages['front'] ?? null;
        if (! $front || ! MannequinModelEdit::where('modelId', $m->id)->where('mode', 'view')->exists()) {
            throw new BusinessRuleException('Primero aprueba una foto de frente', 422);
        }
        $this->assertIdle($m);
        $e = MannequinModelEdit::create([
            'modelId' => $m->id, 'mode' => 'view', 'view' => $view, 'prompt' => trim($prompt), 'status' => MannequinModelEdit::PROCESSING,
            'basePath' => $front, 'createdBy' => $userId,
        ]);
        $this->launcher->launch($e->id, 'mannequin:edit');

        return $this->format($e);
    }

    /** Genera el 3D con las 4 vistas aprobadas (frente + la última buena de cada vista). */
    public function generateFromViews(int $modelId): array
    {
        $m = $this->editable($modelId);
        $this->assertIdle($m);
        $images = ['front' => $m->inputImages['front'] ?? null];
        foreach (MannequinStandard::VIEWS as $view) {
            $images[$view] = MannequinModelEdit::where('modelId', $m->id)->where('mode', 'view')->where('view', $view)
                ->where('status', MannequinModelEdit::DONE)->orderByDesc('id')->value('imagePath');
        }
        if (in_array(null, $images, true)) {
            throw new BusinessRuleException('Faltan vistas: aprueba una foto o rehaz la vista que falló', 422);
        }
        $this->models->regenerate($m, 'vistas', $images);

        return $this->models->format($m->fresh());
    }

    /** Genera el 3D solo con una foto del chat (sale menos fiel en la espalda y los lados). */
    public function apply(int $modelId, int $editId): array
    {
        $m = $this->editable($modelId);
        $e = $this->doneEdit($m, $editId);
        $this->models->regenerate($m, 'foto', ['front' => $e->imagePath]);
        MannequinModelEdit::where('modelId', $m->id)->update(['applied' => false]);
        $e->update(['applied' => true]);

        return $this->models->format($m->fresh());
    }

    /** Arma o edita la foto (corre en segundo plano, comando mannequin:edit). Las vistas siguen en cadena. */
    public function run(int $editId): void
    {
        $e = MannequinModelEdit::find($editId);
        if (! $e || $e->status !== MannequinModelEdit::PROCESSING) {
            return;
        }
        $m = MannequinModel::find($e->modelId);
        $kind = MannequinStandard::kind($m?->config['kind'] ?? null);
        $t0 = microtime(true);
        try {
            $text = $this->english($e->prompt === 'Foto de referencia' ? '' : $e->prompt);
            if ($e->mode === 'text') {
                [$out, $account] = $this->hf->withAccount(MannequinModelService::GPU_SECONDS['text'], fn ($token) => $this->hf->run(
                    self::SPACE_TEXT, '/infer',
                    [MannequinStandard::fromText($kind, $text), random_int(1, 2_000_000_000), false, 1024, 1024, 4],
                    $token, 300,
                ));
            } else {
                $prompt = match ($e->mode) {
                    'base' => MannequinStandard::fromPhoto($kind, $text),
                    'view' => MannequinStandard::view($kind, (string) $e->view, $text),
                    default => MannequinStandard::edit($kind, $text),
                };
                [$out, $account] = $this->hf->withAccount(MannequinModelService::GPU_SECONDS['edit'], fn ($token) => $this->hf->run(
                    self::SPACE_EDIT, '/infer',
                    [['__file' => public_path($e->basePath)], $prompt, random_int(1, 2_000_000_000), false, 2.5, 28],
                    $token, 600,
                ));
            }
            $file = $out[0] ?? null;
            if (! is_array($file) || ! isset($file['url'])) {
                throw new \RuntimeException('El servicio no devolvió la foto');
            }
            $ext = strtolower(pathinfo((string) ($file['path'] ?? $file['url']), PATHINFO_EXTENSION));
            $rel = 'uploads/models3d/'.($m?->key ?? 'm').'-chat-'.$e->id.'-'.time().'.'.(in_array($ext, ['png', 'jpg', 'jpeg', 'webp'], true) ? $ext : 'png');
            $this->ensureDir();
            $this->hf->download($file, public_path($rel), $this->hf->accounts()[$account]);
            if (@getimagesize(public_path($rel)) === false) {
                @unlink(public_path($rel));
                throw new \RuntimeException('La foto que devolvió el servicio no es válida');
            }
            $e->update(['status' => MannequinModelEdit::DONE, 'imagePath' => $rel, 'account' => $account, 'seconds' => (int) round(microtime(true) - $t0)]);
        } catch (Throwable $ex) {
            Log::warning('Chat modelo 3D '.$e->id.': '.$ex->getMessage());
            $e->update(['status' => MannequinModelEdit::FAILED, 'error' => mb_substr($ex->getMessage(), 0, 1000), 'seconds' => (int) round(microtime(true) - $t0)]);
        }

        // Vistas en cadena: la siguiente pendiente del mismo modelo.
        if ($e->mode === 'view') {
            $next = MannequinModelEdit::where('modelId', $e->modelId)->where('mode', 'view')
                ->where('status', MannequinModelEdit::PROCESSING)->where('id', '>', $e->id)->orderBy('id')->value('id');
            if ($next) {
                $this->run($next);
            }
        }
    }

    private function send(int $modelId, string $prompt, ?string $image, ?int $fromEditId, ?int $userId, bool $initial): array
    {
        $m = $this->editable($modelId);
        if ($prompt === '' && ! $image) {
            throw new BusinessRuleException('Escribe qué quieres o adjunta una foto de referencia', 422, ['prompt' => ['Escribe qué quieres']]);
        }
        $this->assertIdle($m);
        if ($image) {
            $saved = $this->uploads->store($this->uploads->decodeBase64($image), 'models3d', 'referencia');
            $base = ltrim($saved['url'], '/');
            $mode = 'base';
        } elseif ($fromEditId || $this->lastPhoto($m)) {
            $base = $this->basePhoto($m, $fromEditId);
            $mode = 'edit';
        } else {
            $base = null;
            $mode = 'text';
        }
        $e = MannequinModelEdit::create([
            'modelId' => $m->id, 'initial' => $initial, 'mode' => $mode, 'prompt' => $prompt !== '' ? $prompt : 'Foto de referencia',
            'status' => MannequinModelEdit::PROCESSING, 'basePath' => $base, 'createdBy' => $userId,
        ]);
        $this->launcher->launch($e->id, 'mannequin:edit');

        return $this->format($e);
    }

    private function editable(int $modelId): MannequinModel
    {
        $m = $this->models->find($modelId);
        if ($m->status === MannequinModel::PUBLISHED) {
            throw new BusinessRuleException('Está publicado: despublícalo antes de cambiar el modelo', 409);
        }
        if ($m->status === MannequinModel::GENERATING) {
            throw new BusinessRuleException('Espera a que termine el 3D que se está generando', 409);
        }

        return $m;
    }

    private function assertIdle(MannequinModel $m): void
    {
        if (MannequinModelEdit::where('modelId', $m->id)->where('status', MannequinModelEdit::PROCESSING)->exists()) {
            throw new BusinessRuleException('Espera a que termine la foto que se está armando', 409);
        }
    }

    private function doneEdit(MannequinModel $m, int $editId): MannequinModelEdit
    {
        $e = MannequinModelEdit::where('modelId', $m->id)->find($editId);
        if (! $e || $e->status !== MannequinModelEdit::DONE || ! $e->imagePath) {
            throw new BusinessRuleException('Esa foto no está lista', 409);
        }

        return $e;
    }

    private function lastPhoto(MannequinModel $m): ?string
    {
        return MannequinModelEdit::where('modelId', $m->id)->where('status', MannequinModelEdit::DONE)
            ->where('mode', '!=', 'view')->orderByDesc('id')->value('imagePath');
    }

    private function basePhoto(MannequinModel $m, ?int $fromEditId): string
    {
        if ($fromEditId) {
            $from = MannequinModelEdit::where('modelId', $m->id)->find($fromEditId);
            if (! $from || $from->status !== MannequinModelEdit::DONE || ! $from->imagePath) {
                throw new BusinessRuleException('Esa foto del chat no está disponible', 422);
            }

            return $from->imagePath;
        }
        $base = $this->lastPhoto($m) ?: ($m->inputImages['front'] ?? null);
        if (! $base || ! is_file(public_path($base))) {
            throw new BusinessRuleException('Todavía no hay foto para cambiar', 422);
        }

        return $base;
    }

    /** Al inglés con el traductor gratis; si falla, el texto tal cual. */
    private function english(string $text): string
    {
        $text = trim($text);
        if ($text === '') {
            return '';
        }
        try {
            $accounts = $this->hf->accounts();
            $out = $this->hf->run(self::SPACE_TRANSLATE, '/translate', [$text, 'Spanish', 'English'], reset($accounts) ?: '', 60);
            $en = trim((string) ($out[0] ?? ''));

            return $en !== '' ? $en : $text;
        } catch (Throwable $ex) {
            Log::info('Traducción del chat 3D: '.$ex->getMessage());

            return $text;
        }
    }

    private function ensureDir(): void
    {
        $dir = public_path('uploads/models3d');
        if (! is_dir($dir) && ! @mkdir($dir, 0775, true) && ! is_dir($dir)) {
            throw new \RuntimeException('No se pudo crear la carpeta uploads/models3d');
        }
    }
}
