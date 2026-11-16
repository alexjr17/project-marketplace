<?php

namespace App\Services\Marketing;

use App\Exceptions\BusinessRuleException;
use App\Models\MarketingProject;
use Illuminate\Http\UploadedFile;

/**
 * Proyectos del estudio de contenido: el trabajo en curso de un post o un video (todo lo armado en el
 * editor, como JSON) para volver a abrirlo, seguir editándolo, duplicarlo o empezar otro. Las imágenes
 * subidas en el momento (diseños, fotos, fondos) se guardan aparte como archivos del proyecto, para
 * que el proyecto se abra igual en cualquier navegador.
 */
class MarketingProjectService
{
    public const FORMATS = ['post', 'video360', 'reel'];

    /** Lo armado en el editor, sin imágenes adentro (van como archivos): con esto sobra. */
    private const MAX_DATA_BYTES = 3_000_000;

    private const IMAGE_TYPES = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'];

    /** La música subida al video también se guarda con el proyecto. */
    private const AUDIO_TYPES = ['audio/mpeg' => 'mp3', 'audio/mp3' => 'mp3', 'audio/wav' => 'wav', 'audio/x-wav' => 'wav', 'audio/ogg' => 'ogg', 'audio/webm' => 'weba', 'audio/mp4' => 'm4a', 'audio/x-m4a' => 'm4a', 'audio/aac' => 'aac'];

    private const DIR = 'uploads/marketing/proyectos';

    /** Para la lista: sin lo armado (pesa), con la miniatura y quién lo tocó último. */
    public function summary(MarketingProject $p): array
    {
        return [
            'id' => $p->id,
            'name' => $p->name,
            'format' => $p->format,
            'source' => $p->source,
            'template' => $p->template,
            'thumb' => $p->thumbPath ? '/'.$p->thumbPath.'?v='.optional($p->updatedAt)->timestamp : null,
            'updatedBy' => $p->editor?->name,
            'createdAt' => $p->createdAt,
            'updatedAt' => $p->updatedAt,
        ];
    }

    public function format(MarketingProject $p): array
    {
        return $this->summary($p) + ['data' => $p->data ?? []];
    }

    public function list(?string $format): array
    {
        return MarketingProject::with('editor')
            ->when($format, fn ($q) => $q->where('format', $format))
            ->orderByDesc('updatedAt')->orderByDesc('id')->limit(200)->get()
            ->map(fn ($p) => $this->summary($p))->all();
    }

    public function show(int $id): array
    {
        return $this->format($this->find($id));
    }

    /** @param array{name:string, format:string, source?:?string, template?:?string, data:array, thumb?:?string} $data */
    public function create(array $data, ?int $userId): array
    {
        $this->checkData($data['data']);
        $thumb = $this->decodeThumb($data['thumb'] ?? null);
        $p = MarketingProject::create([
            'name' => $this->cleanName($data['name']),
            'format' => $data['format'],
            'source' => $data['source'] ?? 'libre',
            'template' => $data['template'] ?? null,
            'data' => $data['data'],
            'createdBy' => $userId,
            'updatedBy' => $userId,
        ]);
        $this->saveThumb($p, $thumb);

        return $this->format($p->fresh('editor'));
    }

    /** Guarda los cambios (el editor guarda solo, cada poco, mientras se trabaja). */
    public function update(int $id, array $data, ?int $userId): array
    {
        $p = $this->find($id);
        if (array_key_exists('data', $data)) {
            $this->checkData($data['data']);
        }
        $thumb = $this->decodeThumb($data['thumb'] ?? null);
        $fields = array_intersect_key($data, array_flip(['format', 'source', 'template', 'data']));
        if (array_key_exists('name', $data)) {
            $fields['name'] = $this->cleanName($data['name']);
        }
        $p->fill($fields + ['updatedBy' => $userId]);
        $p->updatedAt = now();
        $p->save();
        $this->saveThumb($p, $thumb);

        return $this->summary($p->fresh('editor'));
    }

    /** Copia para probar otra versión sin tocar la original. */
    public function duplicate(int $id, ?int $userId): array
    {
        $src = $this->find($id);
        $copy = $src->replicate(['thumbPath']);
        $copy->name = $this->cleanName($src->name.' (copia)');
        $copy->createdBy = $userId;
        $copy->updatedBy = $userId;
        $copy->save();
        if ($src->thumbPath && is_file(public_path($src->thumbPath))) {
            $rel = self::DIR.'/miniaturas/'.$copy->id.'.jpg';
            @copy(public_path($src->thumbPath), public_path($rel));
            $copy->update(['thumbPath' => $rel]);
        }

        return $this->summary($copy->fresh('editor'));
    }

    public function delete(int $id): void
    {
        $p = $this->find($id);
        if ($p->thumbPath) {
            @unlink(public_path($p->thumbPath));
        }
        // Las imágenes del proyecto se quedan: se comparten entre proyectos (mismo archivo, mismo nombre).
        $p->delete();
    }

    /**
     * Guarda una imagen (diseño, foto o fondo) o la música subida en el editor como archivo del proyecto. El nombre
     * es la huella del contenido: la misma imagen no se guarda dos veces.
     */
    public function storeAsset(UploadedFile $file): array
    {
        // El tipo por el contenido (no por el nombre ni lo que diga el navegador).
        $mime = (string) (new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath());
        $ext = self::IMAGE_TYPES[$mime] ?? self::AUDIO_TYPES[$mime] ?? null;
        if (! $ext) {
            throw new BusinessRuleException('El archivo debe ser una imagen (PNG, JPG, WEBP) o un audio (MP3, WAV, OGG, M4A)', 422);
        }
        $this->ensureDir(public_path(self::DIR));
        $name = sha1_file($file->getRealPath()).'.'.$ext;
        if (! is_file(public_path(self::DIR.'/'.$name))) {
            $file->move(public_path(self::DIR), $name);
        }

        return ['url' => '/'.self::DIR.'/'.$name];
    }

    /** La miniatura (imagen en base64) ya validada, o null si no vino. */
    private function decodeThumb(?string $thumb): ?string
    {
        if (! $thumb) {
            return null;
        }
        if (! preg_match('#^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$#', $thumb, $m)) {
            throw new BusinessRuleException('La miniatura no es una imagen válida', 422);
        }
        $bin = base64_decode($m[2], true);
        if ($bin === false || strlen($bin) > 600_000 || @getimagesizefromstring($bin) === false) {
            throw new BusinessRuleException('La miniatura no es una imagen válida', 422);
        }

        return $bin;
    }

    private function saveThumb(MarketingProject $p, ?string $bin): void
    {
        if ($bin === null) {
            return;
        }
        $dir = public_path(self::DIR.'/miniaturas');
        $this->ensureDir($dir);
        $rel = self::DIR.'/miniaturas/'.$p->id.'.jpg';
        file_put_contents(public_path($rel), $bin);
        if ($p->thumbPath !== $rel) {
            $p->thumbPath = $rel;
            $p->saveQuietly();
        }
    }

    private function checkData(array $data): void
    {
        $json = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($json === false || strlen($json) > self::MAX_DATA_BYTES) {
            throw new BusinessRuleException('El proyecto es demasiado grande para guardarlo', 422);
        }
        // Las imágenes van como archivos del proyecto, nunca incrustadas en lo armado.
        if (preg_match('#"data:image/[^"]{2000,}#', $json)) {
            throw new BusinessRuleException('Las imágenes del proyecto se suben aparte', 422);
        }
    }

    private function cleanName(?string $name): string
    {
        $name = trim(preg_replace('/\s+/u', ' ', (string) $name) ?? '');

        return mb_substr($name !== '' ? $name : 'Proyecto sin nombre', 0, 120);
    }

    private function ensureDir(string $dir): void
    {
        if (! is_dir($dir) && ! @mkdir($dir, 0775, true) && ! is_dir($dir)) {
            throw new \RuntimeException('No se pudo crear la carpeta '.$dir);
        }
    }

    private function find(int $id): MarketingProject
    {
        return MarketingProject::with('editor')->find($id) ?? throw new BusinessRuleException('Proyecto no encontrado', 404);
    }
}
