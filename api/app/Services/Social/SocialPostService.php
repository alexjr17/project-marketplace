<?php

namespace App\Services\Social;

use App\Exceptions\BusinessRuleException;
use App\Models\Channel;
use App\Models\SocialPost;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use RuntimeException;
use Throwable;

/**
 * Publicaciones en redes (la página de Facebook y su cuenta de Instagram): borradores, publicar ya,
 * publicar un borrador, programadas (las publica el comando social:publish-scheduled) y borrar
 * (también en Meta si ya estaba publicada).
 */
class SocialPostService
{
    public function __construct(private FacebookPageService $facebook, private InstagramService $instagram) {}

    /**
     * Publica una publicación ya armada (estudio de contenido o programada) en su red. No lanza: si
     * Meta la rechaza queda en estado failed con el motivo.
     */
    public function publishPost(SocialPost $post): SocialPost
    {
        try {
            return $post->platform === 'instagram' ? $this->instagram->publish($post) : $this->facebook->publish($post);
        } catch (Throwable $e) {
            $post->status = 'failed';
            $post->error = $e->getMessage();
            $post->save();

            return $post;
        }
    }

    /** Publica las programadas cuya hora ya llegó. Devuelve cuántas se intentaron. */
    public function publishDue(): int
    {
        $due = SocialPost::where('status', 'scheduled')->where('scheduledAt', '<=', now())->orderBy('scheduledAt')->limit(20)->get();
        foreach ($due as $post) {
            // Se marca antes para que otro proceso no la publique dos veces.
            $claimed = SocialPost::where('id', $post->id)->where('status', 'scheduled')->update(['status' => 'publishing']);
            if ($claimed) {
                $this->publishPost($post->fresh());
            }
        }

        return $due->count();
    }

    public function paginate(?string $status, ?string $platform, int $perPage): LengthAwarePaginator
    {
        return SocialPost::with('channel', 'createdBy')
            ->when($status, fn ($q) => $q->where('status', $status))
            ->when($platform, fn ($q) => $q->where('platform', $platform))
            ->orderByDesc('id')
            ->paginate(max(1, min(100, $perPage)));
    }

    /**
     * Guarda un borrador sin publicar.
     *
     * @param  array{platform:string, content:?string, mediaUrls:array<int,string>}  $data
     */
    public function createDraft(array $data, int $userId): SocialPost
    {
        $post = $this->buildPost($this->facebookChannel()->id, $userId, $data);
        $post->status = 'draft';
        $post->save();

        return $post->fresh(['channel', 'createdBy']);
    }

    /** Crea la publicación y la publica en un solo paso. */
    public function publishNow(array $data, int $userId): SocialPost
    {
        if (empty($data['content']) && empty($data['mediaUrls'])) {
            throw new BusinessRuleException('La publicación debe tener al menos texto o imagen');
        }
        $channel = $this->facebookChannel();

        $post = $this->buildPost($channel->id, $userId, $data);
        $post->status = 'draft';
        $post->save();

        $post = $this->publishToProvider($post);
        if ($post->status === 'failed') {
            throw new BusinessRuleException($post->error ?? 'No se pudo publicar');
        }

        return $post->fresh(['channel', 'createdBy']);
    }

    public function publishExisting(SocialPost $post): SocialPost
    {
        if ($post->status === 'published') {
            throw new BusinessRuleException('La publicación ya fue publicada');
        }

        return $this->publishToProvider($post)->fresh(['channel', 'createdBy']);
    }

    /** Borra en Meta (si estaba publicada) y en local. */
    public function delete(SocialPost $post): void
    {
        if ($post->status === 'published' && $post->platform !== 'instagram') {
            try {
                $this->facebook->delete($post);
            } catch (RuntimeException $e) {
                throw new BusinessRuleException('Error al borrar en Facebook: '.$e->getMessage(), 500);
            }
        }
        $post->delete();
    }

    public function format(SocialPost $p): array
    {
        return [
            'id' => $p->id,
            'channelId' => $p->channelId,
            'platform' => $p->platform,
            'type' => $p->type,
            'content' => $p->content,
            'mediaUrl' => $p->mediaUrl,
            'mediaUrls' => is_array($p->mediaUrls) ? $p->mediaUrls : [],
            'status' => $p->status,
            'scheduledAt' => optional($p->scheduledAt)->toIso8601String(),
            'publishedAt' => optional($p->publishedAt)->toIso8601String(),
            'externalId' => $p->externalId,
            'externalUrl' => $p->externalUrl,
            'error' => $p->error,
            'createdByUserId' => $p->createdByUserId,
            'createdByName' => optional($p->createdBy)->name,
            'createdAt' => optional($p->createdAt)->toIso8601String(),
        ];
    }

    private function publishToProvider(SocialPost $post): SocialPost
    {
        try {
            return $post->platform === 'instagram' ? $this->instagram->publish($post) : $this->facebook->publish($post);
        } catch (Throwable $e) {
            throw new BusinessRuleException('Error al publicar: '.$e->getMessage(), 500);
        }
    }

    /** La página de Facebook usa el mismo canal Messenger (mismo token de página). */
    private function facebookChannel(): Channel
    {
        return Channel::where('type', 'messenger')->first()
            ?? throw new BusinessRuleException('Canal Messenger/FB no configurado');
    }

    private function buildPost(int $channelId, int $userId, array $data): SocialPost
    {
        $urls = $data['mediaUrls'];

        $post = new SocialPost;
        $post->channelId = $channelId;
        $post->platform = $data['platform'];
        $post->type = count($urls) > 0 ? 'photo' : 'text';
        $post->content = $data['content'];
        $post->mediaUrl = $urls[0] ?? null;
        $post->mediaUrls = $urls;
        $post->createdByUserId = $userId;

        return $post;
    }
}
