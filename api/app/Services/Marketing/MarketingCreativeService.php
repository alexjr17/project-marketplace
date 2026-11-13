<?php

namespace App\Services\Marketing;

use App\Exceptions\BusinessRuleException;
use App\Models\Channel;
use App\Models\MarketingCreative;
use App\Models\SocialPost;
use App\Services\Social\SocialPostService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Estudio de contenido: biblioteca de piezas (imagen de post o historia, reel o video 360°) y su
 * publicación en Facebook e Instagram, ya o programada (la sube el comando social:publish-scheduled).
 * Cada publicación es un social_post (aparece también en Publicaciones) con las piezas en metadata.
 */
class MarketingCreativeService
{
    public const KINDS = ['post', 'historia', 'reel', 'video360'];

    public const SOURCES = ['producto', 'coleccion', 'promocion', 'diseno', 'plantilla', 'libre'];

    private const IMAGE_TYPES = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'];

    private const VIDEO_TYPES = ['video/mp4' => 'mp4', 'video/webm' => 'webm', 'video/quicktime' => 'mov'];

    public function __construct(private SocialPostService $posts) {}

    public function format(MarketingCreative $c): array
    {
        return [
            'id' => $c->id,
            'title' => $c->title,
            'kind' => $c->kind,
            'source' => $c->source,
            'sourceIds' => $c->sourceIds ?? [],
            'template' => $c->template,
            'data' => $c->data ?? [],
            'media' => '/'.$c->mediaPath,
            'mediaType' => $c->mediaType,
            'caption' => $c->caption,
            'hashtags' => $c->hashtags ?? [],
            'createdAt' => $c->createdAt,
        ];
    }

    public function list(?string $kind): array
    {
        return MarketingCreative::when($kind, fn ($q) => $q->where('kind', $kind))
            ->orderByDesc('id')->limit(120)->get()->map(fn ($c) => $this->format($c))->all();
    }

    /** Guarda la pieza armada en el estudio (la imagen o el video ya renderizado en el navegador). */
    public function store(array $data, UploadedFile $media, ?int $userId): array
    {
        $mime = (string) $media->getMimeType();
        $isVideo = isset(self::VIDEO_TYPES[$mime]);
        $ext = self::IMAGE_TYPES[$mime] ?? self::VIDEO_TYPES[$mime] ?? null;
        if (! $ext) {
            throw new BusinessRuleException('El archivo debe ser una imagen (PNG, JPG, WEBP) o un video (MP4, WEBM)', 422);
        }
        if (in_array($data['kind'], ['reel', 'video360'], true) !== $isVideo) {
            throw new BusinessRuleException($isVideo ? 'Un video va como reel o video 360°' : 'Un reel o video 360° debe ser un video', 422);
        }
        $dir = public_path('uploads/marketing');
        if (! is_dir($dir) && ! @mkdir($dir, 0775, true) && ! is_dir($dir)) {
            throw new \RuntimeException('No se pudo crear la carpeta uploads/marketing');
        }
        $name = Str::slug(mb_substr($data['title'], 0, 40)).'-'.Str::lower(Str::random(6)).'-'.time().'.'.$ext;
        $media->move($dir, $name);

        $c = MarketingCreative::create([
            'title' => trim($data['title']),
            'kind' => $data['kind'],
            'source' => $data['source'] ?? 'libre',
            'sourceIds' => $data['sourceIds'] ?? [],
            'template' => $data['template'] ?? null,
            'data' => $data['data'] ?? null,
            'mediaPath' => 'uploads/marketing/'.$name,
            'mediaType' => $isVideo ? 'video' : 'image',
            'caption' => $data['caption'] ?? null,
            'hashtags' => array_values(array_filter((array) ($data['hashtags'] ?? []))),
            'createdBy' => $userId,
        ]);

        return $this->format($c);
    }

    public function update(int $id, array $data): array
    {
        $c = $this->find($id);
        $c->update(array_intersect_key($data, array_flip(['title', 'caption', 'hashtags'])));

        return $this->format($c->fresh());
    }

    public function delete(int $id): void
    {
        $c = $this->find($id);
        $hasScheduled = SocialPost::where('status', 'scheduled')->get()
            ->contains(fn ($p) => in_array($c->id, (array) ($p->metadata['creativeIds'] ?? []), true));
        if ($hasScheduled) {
            throw new BusinessRuleException('Tiene publicaciones programadas: cancélalas primero en el calendario', 409);
        }
        $path = public_path($c->mediaPath);
        // La publicación ya hecha no se toca (Meta guardó su copia); el archivo se borra si nadie lo usa.
        $used = SocialPost::where('mediaUrl', 'like', '%'.basename($c->mediaPath))->exists();
        if (! $used && is_file($path)) {
            @unlink($path);
        }
        $c->delete();
    }

    /**
     * Publica ya o programa una o varias piezas en Facebook y/o Instagram. Varias imágenes van como
     * carrusel; un video, como reel/video; una historia, como historia.
     *
     * @param  array{creativeIds:array<int,int>, platforms:array<int,string>, caption?:?string, scheduledAt?:?string}  $data
     */
    public function publish(array $data, int $userId): array
    {
        $creatives = MarketingCreative::whereIn('id', $data['creativeIds'])->get()->sortBy(fn ($c) => array_search($c->id, $data['creativeIds'], true))->values();
        if ($creatives->isEmpty()) {
            throw new BusinessRuleException('Elige al menos una pieza', 422);
        }
        $videos = $creatives->where('mediaType', 'video');
        $stories = $creatives->where('kind', 'historia');
        if (($videos->count() || $stories->count()) && $creatives->count() > 1) {
            throw new BusinessRuleException('Un video o una historia se publica solo (los carruseles son de imágenes de post)', 422);
        }
        if ($creatives->count() > 10) {
            throw new BusinessRuleException('Un carrusel lleva máximo 10 imágenes', 422);
        }
        $channel = Channel::where('type', 'messenger')->first();
        if (! $channel || empty($channel->config['pageId']) || empty($channel->config['pageAccessToken'])) {
            throw new BusinessRuleException('Conecta la página de Facebook en Social → Canales (con su token) para publicar', 422);
        }

        $first = $creatives->first();
        $type = $stories->count() ? 'story' : ($videos->count() ? 'video' : 'photo');
        $caption = trim((string) ($data['caption'] ?? $first->caption ?? ''));
        $tags = $first->hashtags ?? [];
        if ($tags && ! str_contains($caption, '#')) {
            $caption .= "\n\n".implode(' ', array_map(fn ($t) => '#'.$t, $tags));
        }
        $when = ! empty($data['scheduledAt']) ? Carbon::parse($data['scheduledAt']) : null;
        if ($when && $when->isPast() && $when->diffInMinutes(now()) > 2) {
            throw new BusinessRuleException('La fecha programada ya pasó', 422);
        }
        $urls = $creatives->map(fn ($c) => '/'.$c->mediaPath)->all();

        $out = [];
        foreach (array_unique($data['platforms']) as $platform) {
            $post = new SocialPost;
            $post->channelId = $channel->id;
            $post->platform = $platform;
            $post->type = $type;
            $post->content = $caption;
            $post->mediaUrl = $urls[0];
            $post->mediaUrls = $urls;
            $post->createdByUserId = $userId;
            $post->metadata = ['creativeIds' => $creatives->pluck('id')->all(), 'kind' => $first->kind, 'title' => $first->title];
            $post->scheduledAt = $when;
            $post->status = $when && $when->isFuture() ? 'scheduled' : 'publishing';
            $post->save();
            if ($post->status === 'publishing') {
                $post = $this->posts->publishPost($post);
            }
            $out[] = $this->posts->format($post->fresh(['channel', 'createdBy'])) + ['metadata' => $post->metadata];
        }

        return $out;
    }

    /** Publicaciones del mes (programadas, publicadas o con error) para el calendario. */
    public function calendar(string $month): array
    {
        $start = Carbon::createFromFormat('Y-m', $month)->startOfMonth();
        $end = $start->copy()->endOfMonth();
        $thumbs = [];

        return SocialPost::with('channel', 'createdBy')
            ->where(fn ($q) => $q->whereBetween('scheduledAt', [$start, $end])->orWhereBetween('publishedAt', [$start, $end])
                ->orWhere(fn ($w) => $w->whereNull('scheduledAt')->whereNull('publishedAt')->whereBetween('createdAt', [$start, $end])))
            ->orderBy('scheduledAt')->get()
            ->map(function ($p) use (&$thumbs) {
                $ids = (array) ($p->metadata['creativeIds'] ?? []);
                $c = $ids ? ($thumbs[$ids[0]] ??= MarketingCreative::find($ids[0])) : null;

                return $this->posts->format($p) + [
                    'metadata' => $p->metadata,
                    'date' => optional($p->scheduledAt ?? $p->publishedAt ?? $p->createdAt)->toIso8601String(),
                    'thumb' => $c ? '/'.$c->mediaPath : $p->mediaUrl,
                    'thumbType' => $c?->mediaType ?? 'image',
                    'title' => $p->metadata['title'] ?? mb_substr((string) $p->content, 0, 40),
                ];
            })->all();
    }

    /** Cambia la fecha de una publicación programada. */
    public function reschedule(int $postId, string $scheduledAt): array
    {
        $p = SocialPost::find($postId) ?? throw new BusinessRuleException('Publicación no encontrada', 404);
        if ($p->status !== 'scheduled') {
            throw new BusinessRuleException('Solo se cambia la fecha de una publicación programada', 409);
        }
        $when = Carbon::parse($scheduledAt);
        if ($when->isPast()) {
            throw new BusinessRuleException('La fecha programada ya pasó', 422);
        }
        $p->update(['scheduledAt' => $when]);

        return $this->posts->format($p->fresh(['channel', 'createdBy']));
    }

    private function find(int $id): MarketingCreative
    {
        return MarketingCreative::find($id) ?? throw new BusinessRuleException('Pieza no encontrada', 404);
    }
}
