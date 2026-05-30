<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Channel;
use App\Models\SocialPost;
use App\Services\Social\FacebookPageService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;
use Throwable;

/**
 * CRUD de publicaciones y disparo de la publicación al proveedor.
 * Fase A: Facebook Page. Instagram/programación en fases siguientes.
 */
class SocialPostController extends Controller
{
    use ApiResponse;

    public function __construct(private FacebookPageService $facebook) {}

    public function index(Request $request)
    {
        $query = SocialPost::with('channel', 'createdBy')
            ->orderByDesc('id');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->filled('platform')) {
            $query->where('platform', $request->query('platform'));
        }

        $perPage = max(1, min(100, (int) $request->query('perPage', 20)));
        $paginator = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => collect($paginator->items())->map(fn ($p) => $this->format($p))->all(),
            'pagination' => [
                'page' => $paginator->currentPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'totalPages' => $paginator->lastPage(),
            ],
        ]);
    }

    public function show(int $id)
    {
        $post = SocialPost::with('channel', 'createdBy')->find($id);
        if (! $post) {
            return $this->error('Publicación no encontrada', 404);
        }

        return $this->success($this->format($post));
    }

    /** Crea borrador (sin publicar). */
    public function store(Request $request)
    {
        $data = $this->validatePostPayload($request);

        // Para Fase A FB usamos el mismo canal Messenger (mismo Page Token).
        $channel = Channel::where('type', 'messenger')->first();
        if (! $channel) {
            return $this->error('Canal Messenger/FB no configurado', 422);
        }

        $post = $this->buildPostFromInput($channel->id, $request->user()->id, $data);
        $post->status = 'draft';
        $post->save();

        return $this->created($this->format($post->fresh(['channel', 'createdBy'])), 'Borrador creado');
    }

    /** Crea + publica en un solo paso. */
    public function publishNow(Request $request)
    {
        $data = $this->validatePostPayload($request);

        $hasContent = ! empty($data['content']);
        $hasMedia = ! empty($data['mediaUrl']) || (! empty($data['mediaUrls']) && count($data['mediaUrls']) > 0);
        if (! $hasContent && ! $hasMedia) {
            return $this->error('La publicación debe tener al menos texto o imagen', 422);
        }

        $channel = Channel::where('type', 'messenger')->first();
        if (! $channel) {
            return $this->error('Canal Messenger/FB no configurado', 422);
        }

        $post = $this->buildPostFromInput($channel->id, $request->user()->id, $data);
        $post->status = 'draft';
        $post->save();

        try {
            $post = $this->facebook->publish($post);
        } catch (Throwable $e) {
            return $this->error('Error al publicar: '.$e->getMessage(), 500);
        }

        if ($post->status === 'failed') {
            return $this->error($post->error ?? 'No se pudo publicar', 422);
        }

        return $this->created($this->format($post->fresh(['channel', 'createdBy'])), 'Publicado en Facebook');
    }

    // ============================== HELPERS ==============================

    /**
     * @return array{platform: string, content: ?string, mediaUrl: ?string, mediaUrls: array<int,string>}
     */
    private function validatePostPayload(Request $request): array
    {
        $data = $request->validate([
            'platform' => ['required', Rule::in(['facebook'])],
            'content' => 'nullable|string|max:10000',
            // 2000 chars: cubre URLs largas de Cloudinary con transformaciones,
            // pero sigue rechazando data:base64 (que Meta no acepta de todas formas).
            'mediaUrl' => 'nullable|string|max:2000',
            'mediaUrls' => 'nullable|array|max:10',
            'mediaUrls.*' => 'string|max:2000',
        ]);

        // Normaliza ambos campos a una lista única. mediaUrls tiene precedencia;
        // si solo viene mediaUrl, lo metemos en el array para uniformidad.
        $urls = $data['mediaUrls'] ?? [];
        if (empty($urls) && ! empty($data['mediaUrl'])) {
            $urls = [$data['mediaUrl']];
        }
        $urls = array_values(array_filter(array_map('trim', $urls), fn ($u) => $u !== ''));

        return [
            'platform' => $data['platform'],
            'content' => $data['content'] ?? null,
            'mediaUrl' => $urls[0] ?? null,
            'mediaUrls' => $urls,
        ];
    }

    private function buildPostFromInput(int $channelId, int $userId, array $data): SocialPost
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

    /** Publica un borrador existente. */
    public function publishExisting(int $id)
    {
        $post = SocialPost::with('channel')->find($id);
        if (! $post) {
            return $this->error('Publicación no encontrada', 404);
        }
        if ($post->status === 'published') {
            return $this->error('La publicación ya fue publicada', 422);
        }

        try {
            $post = $this->facebook->publish($post);
        } catch (Throwable $e) {
            return $this->error('Error al publicar: '.$e->getMessage(), 500);
        }

        return $this->success($this->format($post->fresh(['channel', 'createdBy'])), 'Publicado');
    }

    /** Elimina en Meta y en local. */
    public function destroy(int $id)
    {
        $post = SocialPost::with('channel')->find($id);
        if (! $post) {
            return $this->error('Publicación no encontrada', 404);
        }

        if ($post->status === 'published') {
            try {
                $this->facebook->delete($post);
            } catch (RuntimeException $e) {
                return $this->error('Error al borrar en Facebook: '.$e->getMessage(), 500);
            }
        }
        $post->delete();

        return $this->success(null, 'Publicación eliminada');
    }

    private function format(SocialPost $p): array
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
}
